"""Tests for automation/build_cycle_counts.py.

Stdlib unittest on purpose -- this repo has no Python dependencies and the
workflow runner shouldn't grow one just to run these.

    python3 -m unittest discover -s automation/tests -v
"""

import json
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import build_cycle_counts as bcc  # noqa: E402

FIXTURES = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fixtures')
WEEK_A = '8/20-8/26'   # scheduled group: Shoes
WEEK_B = '8/27-9/2'    # scheduled group: Poly/Entry Balls


def load_fixture(name='weekly_two_rotations.json'):
    with open(os.path.join(FIXTURES, name)) as fh:
        return json.load(fh)


def quiet(*_args, **_kwargs):
    pass


class WeekLabels(unittest.TestCase):
    def test_thursday_starts_its_own_week(self):
        self.assertEqual(bcc.thursday_week('2026-08-20 00:00:01'), WEEK_A)

    def test_wednesday_ends_it(self):
        self.assertEqual(bcc.thursday_week('2026-08-26 23:59:59'), WEEK_A)

    def test_thursday_rolls_over(self):
        self.assertEqual(bcc.thursday_week('2026-08-27 00:00:00'), WEEK_B)

    def test_label_spans_a_month_boundary(self):
        self.assertEqual(bcc.thursday_week('2026-08-31 12:00:00'), WEEK_B)

    def test_ares_iso_week_field_is_ignored(self):
        # The fixture's first cell is tagged 2026-W35 but falls in WEEK_A.
        # ISO weeks run Mon-Sun; these run Thu-Wed. Three days apart.
        cell = load_fixture()['data']['cells'][0]
        self.assertEqual(cell['week'], '2026-W35')
        self.assertEqual(bcc.thursday_week(cell['date']), WEEK_A)


class Exclusions(unittest.TestCase):
    def test_excluded_by_id(self):
        for bid in (1, 44, 103):
            self.assertTrue(bcc.is_excluded({'branchId': bid, 'branchName': 'Store'}))

    def test_excluded_by_name(self):
        for name in ('HQ Admin', 'Main Warehouse', 'Head Office', 'BowlersMart Dropship'):
            self.assertTrue(bcc.is_excluded({'branchId': 999, 'branchName': name}))

    def test_real_stores_survive(self):
        branches = bcc.included_branches(load_fixture()['data']['branches'])
        self.assertEqual(
            sorted(b['branchName'] for b in branches),
            ['BowlersMart Alpha', 'BowlersMart Bravo', 'BowlersMart Charlie',
             'BowlersMart Delta', 'BowlersMart Echo'])


class RotationDerivation(unittest.TestCase):
    def setUp(self):
        self.cells = load_fixture()['data']['cells']
        self.matrix = bcc.build_matrix(self.cells)

    def test_schedule_is_the_modal_group(self):
        # WEEK_B holds 4 on-time Poly counts and 1 late Shoes count.
        self.assertEqual(self.matrix[WEEK_B]['Poly/Entry Balls'], 4)
        self.assertEqual(self.matrix[WEEK_B]['Shoes'], 1)
        self.assertEqual(bcc.derive_schedule(self.matrix),
                         {WEEK_A: 'Shoes', WEEK_B: 'Poly/Entry Balls'})

    def test_unknown_group_falls_back_to_filing_week(self):
        weeks_for = bcc.weeks_by_group(bcc.derive_schedule(self.matrix))
        stray = {'cycleGroup': 'Never Seen', 'date': '2026-08-21 09:00:00'}
        self.assertEqual(bcc.assign_week(stray, weeks_for), WEEK_A)

    def test_counts_the_late_credits(self):
        self.assertEqual(bcc.count_late_credits(self.cells), 1)


class LateFilingInTheSameWeek(unittest.TestCase):
    """The case that motivated the whole re-crediting step.

    Delta filed Shoes late (8/28, belonging to the 8/20-8/26 Shoes week) and
    Poly/Entry on time (8/29) -- both inside the same calendar week. Bucketing
    by filing date puts both in WEEK_B, and since only one record per store per
    week survives, Delta's on-time count would be thrown away entirely.
    """

    def setUp(self):
        self.stores = bcc.build_payload(load_fixture())['stores']

    def test_late_count_lands_in_its_scheduled_week(self):
        self.assertEqual(self.stores['BowlersMart Delta'][WEEK_A]['group'], 'Shoes')
        self.assertEqual(self.stores['BowlersMart Delta'][WEEK_A]['date'],
                         '2026-08-28 16:00:00')

    def test_on_time_count_is_not_discarded(self):
        self.assertEqual(self.stores['BowlersMart Delta'][WEEK_B]['group'],
                         'Poly/Entry Balls')

    def test_delta_is_complete_for_both_weeks(self):
        self.assertTrue(self.stores['BowlersMart Delta'][WEEK_A]['done'])
        self.assertTrue(self.stores['BowlersMart Delta'][WEEK_B]['done'])


class Grid(unittest.TestCase):
    def setUp(self):
        self.payload = bcc.build_payload(load_fixture())
        self.stores = self.payload['stores']

    def test_weeks_are_ordered(self):
        self.assertEqual(self.payload['cycleWeeks'], [WEEK_A, WEEK_B])

    def test_zero_count_store_still_appears(self):
        self.assertIn('BowlersMart Echo', self.stores)
        self.assertEqual(self.stores['BowlersMart Echo'], {})

    def test_excluded_branches_leave_no_rows(self):
        self.assertNotIn('Main Warehouse', self.stores)
        self.assertNotIn('BowlersMart Dropship', self.stores)

    def test_earliest_filing_wins_within_a_week(self):
        # Alpha filed Shoes twice in WEEK_A; the 8/20 record is the one kept.
        self.assertEqual(self.stores['BowlersMart Alpha'][WEEK_A]['date'],
                         '2026-08-20 09:00:00')
        self.assertEqual(self.stores['BowlersMart Alpha'][WEEK_A]['dollarNet'], 1.5)

    def test_pending_and_denied_are_not_done(self):
        self.assertEqual(self.stores['BowlersMart Charlie'][WEEK_B]['status'], 'Pending')
        self.assertFalse(self.stores['BowlersMart Charlie'][WEEK_B]['done'])
        self.assertEqual(self.stores['BowlersMart Bravo'][WEEK_B]['status'], 'Denied')
        self.assertFalse(self.stores['BowlersMart Bravo'][WEEK_B]['done'])


class MergeHistory(unittest.TestCase):
    def old_file(self):
        return {
            'cycleWeeks': ['8/13-8/19', WEEK_A],
            'stores': {
                'BowlersMart Alpha': {
                    '8/13-8/19': {'done': True, 'status': 'Done', 'group': 'Bags',
                                  'date': '2026-08-13 09:00:00', 'dollarNet': 1.0},
                    WEEK_A: {'done': False, 'status': 'Pending', 'group': 'Shoes',
                             'date': '2026-08-20 09:00:00', 'dollarNet': 0.0},
                },
                # Excluded after this file was written. Must not come back.
                'BowlersMart Dropship': {
                    '8/13-8/19': {'done': True, 'status': 'Done', 'group': 'Bags',
                                  'date': '2026-08-13 09:00:00', 'dollarNet': 0.0},
                },
            },
        }

    def merged(self):
        payload = bcc.build_payload(load_fixture())
        return bcc.merge_history(payload, self.old_file(), log=quiet)

    def test_now_excluded_store_is_not_resurrected(self):
        self.assertNotIn('BowlersMart Dropship', self.merged()['stores'])

    def test_older_weeks_are_carried_forward(self):
        merged = self.merged()
        self.assertEqual(merged['cycleWeeks'], ['8/13-8/19', WEEK_A, WEEK_B])
        self.assertIn('8/13-8/19', merged['stores']['BowlersMart Alpha'])

    def test_fresh_data_wins_over_history(self):
        alpha = self.merged()['stores']['BowlersMart Alpha'][WEEK_A]
        self.assertEqual(alpha['status'], 'Done')
        self.assertTrue(alpha['done'])

    def test_reports_what_it_dropped(self):
        lines = []
        bcc.merge_history(bcc.build_payload(load_fixture()), self.old_file(),
                          log=lines.append)
        self.assertTrue(any('Dropship' in line for line in lines))


class CommandLine(unittest.TestCase):
    def run_main(self, raw, existing=None):
        with tempfile.TemporaryDirectory() as tmp:
            src = os.path.join(tmp, 'pc.json')
            out = os.path.join(tmp, 'cycle-counts.json')
            with open(src, 'w') as fh:
                json.dump(raw, fh)
            if existing is not None:
                with open(out, 'w') as fh:
                    json.dump(existing, fh)
            code = bcc.main(['--input', src, '--output', out, '--quiet'])
            written = None
            if os.path.exists(out):
                with open(out) as fh:
                    written = json.load(fh)
            return code, written

    def test_writes_the_payload(self):
        code, written = self.run_main(load_fixture())
        self.assertEqual(code, 0)
        self.assertEqual(written['source'], bcc.SOURCE)
        self.assertEqual(written['cycleWeeks'], [WEEK_A, WEEK_B])
        self.assertEqual(len(written['stores']), 5)

    def test_api_failure_leaves_the_file_untouched(self):
        untouched = {'cycleWeeks': ['8/13-8/19'], 'stores': {'Keep Me': {}}}
        code, written = self.run_main({'success': False}, existing=untouched)
        self.assertEqual(code, 0)
        self.assertEqual(written, untouched)

    def test_unreadable_history_does_not_lose_the_run(self):
        with tempfile.TemporaryDirectory() as tmp:
            src = os.path.join(tmp, 'pc.json')
            out = os.path.join(tmp, 'cycle-counts.json')
            with open(src, 'w') as fh:
                json.dump(load_fixture(), fh)
            with open(out, 'w') as fh:
                fh.write('{ this is not json')
            self.assertEqual(
                bcc.main(['--input', src, '--output', out, '--quiet']), 0)
            with open(out) as fh:
                self.assertEqual(len(json.load(fh)['stores']), 5)


if __name__ == '__main__':
    unittest.main()
