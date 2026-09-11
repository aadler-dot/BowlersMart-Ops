#!/usr/bin/env python3
"""Build cycle-counts.json from the Ares weekly physical-counts endpoint.

    GET /pos/api/v1/inventory/physical-counts/weekly

Lifted verbatim (behaviour-for-behaviour) out of the heredoc in
.github/workflows/deploy.yml so the logic can be tested. See
automation/tests/test_build_cycle_counts.py.

Three things here are non-obvious; all three cost real time to work out:

1. The `week` field in each cell is an ISO week (Mon-Sun). The sheets this
   dashboard came from use Thursday-Wednesday weeks, so the two are offset by
   three days and disagree on the boundary. Bucket by the `date` timestamp,
   never by `week`.

2. A count belongs to the week its cycle GROUP was scheduled, not the week the
   store got around to filing it. Stores file late. The schedule is derived
   from the data itself (a week's scheduled group is whichever group most
   stores counted that week) so it keeps working as the rotation advances --
   do not hardcode a rotation.

3. The endpoint returns exactly one 8-week rotation and the window slides
   forward daily. That is the full rotation, not a limitation, but it does mean
   older weeks fall out of the payload -- hence the merge against the previous
   cycle-counts.json.
"""

import argparse
import collections
import datetime
import json
import os
import sys

EXCLUDE_IDS = {1, 44, 103}  # Warehouse, Head Office, HQ
EXCLUDE_NAMES = ('HQ', 'Warehouse', 'Head Office', 'Dropship')

# Week labels carry no year ("8/13-8/19"), matching the sheet columns they
# overlay. Sorting therefore needs a year supplied from outside.
YEAR = 2026

SOURCE = 'ares:/inventory/physical-counts/weekly'
TS_FORMAT = '%Y-%m-%d %H:%M:%S'


# ---------------------------------------------------------------- week labels

def thursday_week(ts):
    """Label the Thursday-Wednesday week containing timestamp `ts`."""
    d = datetime.datetime.strptime(ts, TS_FORMAT).date()
    start = d - datetime.timedelta(days=(d.weekday() - 3) % 7)
    end = start + datetime.timedelta(days=6)
    return '%d/%d-%d/%d' % (start.month, start.day, end.month, end.day)


def week_start(label, year=YEAR):
    """The start date of a "8/13-8/19" style label."""
    month, day = label.split('-')[0].split('/')
    return datetime.date(year, int(month), int(day))


def sort_weeks(labels, year=YEAR):
    return sorted(labels, key=lambda w: week_start(w, year))


# ------------------------------------------------------------- the rotation

def build_matrix(cells):
    """week label -> Counter of cycle groups counted in it."""
    matrix = collections.defaultdict(collections.Counter)
    for cell in cells:
        if cell.get('date'):
            matrix[thursday_week(cell['date'])][cell.get('cycleGroup', '?')] += 1
    return matrix


def derive_schedule(matrix):
    """week label -> the group that week was scheduled for.

    Whichever group most stores counted that week is the scheduled one;
    stragglers filing late for the previous group are the minority.
    """
    return {week: groups.most_common(1)[0][0] for week, groups in matrix.items()}


def weeks_by_group(schedule, year=YEAR):
    """group -> its scheduled weeks, oldest first."""
    weeks_for = collections.defaultdict(list)
    for week, group in schedule.items():
        weeks_for[group].append(week)
    for group in weeks_for:
        weeks_for[group] = sort_weeks(weeks_for[group], year)
    return weeks_for


def assign_week(cell, weeks_for, year=YEAR):
    """Credit a count to the week its group was scheduled.

    A group recurs every 8 weeks, so pick the latest scheduled occurrence at or
    before the submission date. Falls back to the filing week for a group we
    have no schedule for.
    """
    group = cell.get('cycleGroup')
    filed = datetime.datetime.strptime(cell['date'], TS_FORMAT).date()
    candidates = weeks_for.get(group)
    if not candidates:
        return thursday_week(cell['date'])
    prior = [w for w in candidates if week_start(w, year) <= filed]
    return prior[-1] if prior else candidates[0]


# ------------------------------------------------------------------- branches

def is_excluded(branch):
    return (branch['branchId'] in EXCLUDE_IDS
            or any(x in branch['branchName'] for x in EXCLUDE_NAMES))


def included_branches(branches):
    return [b for b in branches if not is_excluded(b)]


# ----------------------------------------------------------------- the grid

def build_grid(cells, branches, weeks_for, year=YEAR):
    """store name -> week label -> record. Every branch appears, even at zero."""
    stores = {b['branchName']: {} for b in branches}
    names = {b['branchId']: b['branchName'] for b in branches}
    for cell in cells:
        name = names.get(cell.get('branchId'))
        if not name or not cell.get('date'):
            continue
        week = assign_week(cell, weeks_for, year)
        previous = stores[name].get(week)
        # One record per store per week; the earliest filing wins.
        if previous is None or cell['date'] < previous['date']:
            stores[name][week] = {
                'done': cell.get('status') == 'Done',
                'status': cell.get('status'),
                'group': cell.get('cycleGroup'),
                'date': cell['date'],
                'dollarNet': cell.get('dollarNet'),
            }
    return stores


def build_payload(raw, year=YEAR, now=None):
    """Turn an Ares response into a cycle-counts payload (pre-merge)."""
    data = raw['data']
    cells = data.get('cells', [])
    branches = included_branches(data.get('branches', []))

    matrix = build_matrix(cells)
    weeks_for = weeks_by_group(derive_schedule(matrix), year)
    stores = build_grid(cells, branches, weeks_for, year)

    generated = now or datetime.datetime.now(datetime.timezone.utc)
    return {
        'generated': generated.isoformat(),
        'source': SOURCE,
        'cycleWeeks': sort_weeks(matrix.keys(), year),
        'stores': stores,
    }


def merge_history(payload, old, year=YEAR, log=print):
    """Layer `payload` over a previous cycle-counts.json.

    The API only ever returns the current 8-week rotation, so older weeks live
    only in the committed file. Exclusions are re-applied on the way through:
    carrying every historical store name forward silently resurrects names
    excluded later (this is exactly how Dropship kept coming back).
    """
    allowed = set(payload['stores'])
    old_stores = old.get('stores', {})

    dropped = [n for n in old_stores if n not in allowed]
    if dropped:
        log('dropped from history (now excluded): %s' % ', '.join(sorted(dropped)))

    for name, weeks in old_stores.items():
        if name not in allowed:
            continue
        merged = dict(weeks)
        merged.update(payload['stores'].get(name, {}))
        payload['stores'][name] = merged

    payload['cycleWeeks'] = sort_weeks(
        set(old.get('cycleWeeks', [])) | set(payload['cycleWeeks']), year)
    return payload


# --------------------------------------------------------------- diagnostics

def report_rotation(cells, matrix, year=YEAR, log=print):
    """Diagnostics for the current run. Drop these once the feed is boring."""
    log('statuses: %s' % dict(
        collections.Counter(c.get('status', '?') for c in cells)))
    dates = sorted(c['date'] for c in cells if c.get('date'))
    if dates:
        log('data range: %s .. %s' % (dates[0], dates[-1]))

    log('\nweek -> cycleGroup (this is the rotation):')
    for week in sort_weeks(matrix.keys(), year):
        for group, n in matrix[week].most_common():
            log('   %-14s %-40s %d' % (week, group, n))


def report_totals(payload, log=print):
    stores = payload['stores']
    weeks = payload['cycleWeeks']
    records = [v for r in stores.values() for v in r.values()]
    done = sum(1 for v in records if v['done'])
    pending = sum(1 for v in records if v.get('status') == 'Pending')
    denied = sum(1 for v in records if v.get('status') == 'Denied')
    slots = len(stores) * len(weeks)

    log('\nstores: %d (all branches, incl. zero-count) | weeks: %d'
        % (len(stores), len(weeks)))
    log('done %d | pending %d | denied %d | %d slots -> %.1f%%'
        % (done, pending, denied, slots, (done / slots * 100) if slots else 0))
    zero = [n for n, r in stores.items() if not any(v['done'] for v in r.values())]
    log('stores with zero completions (%d): %s'
        % (len(zero), ', '.join(sorted(zero)[:12])))


# ---------------------------------------------------------------------- main

def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument('--input', required=True,
                    help='the raw Ares response, as JSON')
    ap.add_argument('--output', default='cycle-counts.json',
                    help='file to write, and to merge history from')
    ap.add_argument('--year', type=int, default=YEAR,
                    help='year the undated week labels belong to')
    ap.add_argument('--quiet', action='store_true',
                    help='suppress the per-run diagnostics')
    args = ap.parse_args(argv)

    log = (lambda *a: None) if args.quiet else print

    with open(args.input) as fh:
        raw = json.load(fh)

    if not raw.get('success'):
        print('::warning::API success=false; leaving %s untouched' % args.output)
        return 0

    cells = raw['data'].get('cells', [])
    report_rotation(cells, build_matrix(cells), args.year, log)

    payload = build_payload(raw, args.year)

    moved = count_late_credits(cells, args.year)
    log('\nlate submissions re-credited to their scheduled week: %d' % moved)

    if os.path.exists(args.output):
        try:
            with open(args.output) as fh:
                old = json.load(fh)
            merge_history(payload, old, args.year, log)
        except Exception as e:
            print('::warning::merge failed: %s' % e)

    with open(args.output, 'w') as fh:
        json.dump(payload, fh, indent=1)

    report_totals(payload, log)
    return 0


def count_late_credits(cells, year=YEAR):
    """How many cells got re-credited away from the week they were filed in."""
    weeks_for = weeks_by_group(derive_schedule(build_matrix(cells)), year)
    return sum(1 for c in cells
               if c.get('date')
               and assign_week(c, weeks_for, year) != thursday_week(c['date']))


if __name__ == '__main__':
    sys.exit(main())
