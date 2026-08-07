const CYCLE_SHEETS = [
  {
    sheetId: '1hq7Y2o4gmdTWlL8ZQP-kgrprVNcLfr52sGHuPc9ogS4',
    gid: '0',
    pctIdx: 15,
    notesIdx: 16,
    // Columns: A=Store, B-M=weekly boolean checkboxes, P=% Complete, Q=Notes
    weekCols: [
      {idx:1,  label:'Shoes',              week:'1/8-1/14'},
      {idx:2,  label:'Poly/Entry',         week:'1/15-1/21'},
      {idx:3,  label:'Bags',               week:'1/22-1/28'},
      {idx:4,  label:'Grips/Slugs',        week:'1/29-2/4'},
      {idx:5,  label:'Jerseys',            week:'2/5-2/11'},
      {idx:6,  label:'Perf. Balls',        week:'2/12-2/18'},
      {idx:7,  label:'Towel/Shammy/Tape',  week:'2/19-2/25'},
      {idx:8,  label:'Gloves/Cleaners',    week:'2/26-3/4'},
      {idx:9,  label:'Shoes',              week:'3/5-3/11'},
      {idx:10, label:'Poly/Entry',         week:'3/12-3/18'},
      {idx:11, label:'Bags',               week:'3/19-3/25'},
      {idx:12, label:'Grips/Slugs',        week:'3/26-4/1'},
    ]
  },
  {
    sheetId: '1hq7Y2o4gmdTWlL8ZQP-kgrprVNcLfr52sGHuPc9ogS4',
    gid: '70556277',
    pctIdx: 14,
    notesIdx: 15,
    // Q2 tab: covers 4/2 through 7/1
    weekCols: [
      {idx:1,  label:'Jerseys',            week:'4/2-4/8'},
      {idx:2,  label:'Perf. Balls',        week:'4/9-4/15'},
      {idx:3,  label:'Towel/Shammy/Tape',  week:'4/16-4/22'},
      {idx:4,  label:'Gloves/Cleaners',    week:'4/23-4/29'},
      {idx:5,  label:'Shoes',              week:'4/30-5/6'},
      {idx:6,  label:'Poly/Entry',         week:'5/7-5/13'},
      {idx:7,  label:'Bags',               week:'5/14-5/20'},
      {idx:8,  label:'Grips/Slugs',        week:'5/21-5/27'},
      {idx:9,  label:'Jerseys',            week:'5/28-6/3'},
      {idx:10, label:'Perf. Balls',        week:'6/4-6/10'},
      {idx:11, label:'Towel/Shammy/Tape',  week:'6/11-6/17'},
      {idx:12, label:'Gloves/Cleaners',    week:'6/18-6/24'},
      {idx:13, label:'Shoes',              week:'6/25-7/1'},
    ]
  },
  {
    sheetId: '1hq7Y2o4gmdTWlL8ZQP-kgrprVNcLfr52sGHuPc9ogS4',
    gid: '440026805',
    pctIdx: 14,
    notesIdx: 15,
    // Q3 tab: covers 7/2 through 9/30
    weekCols: [
      {idx:1,  label:'Poly/Entry',         week:'7/2-7/8'},
      {idx:2,  label:'Bags',               week:'7/9-7/15'},
      {idx:3,  label:'Grips/Slugs',        week:'7/16-7/22'},
      {idx:4,  label:'Jerseys',            week:'7/23-7/29'},
      {idx:5,  label:'Perf. Balls',        week:'7/30-8/5'},
      {idx:6,  label:'Towel/Shammy/Tape',  week:'8/6-8/12'},
      {idx:7,  label:'Gloves/Cleaners',    week:'8/13-8/19'},
      {idx:8,  label:'Shoes',              week:'8/20-8/26'},
      {idx:9,  label:'Poly/Entry',         week:'8/27-9/2'},
      {idx:10, label:'Bags',               week:'9/3-9/9'},
      {idx:11, label:'Grips/Slugs',        week:'9/10-9/16'},
      {idx:12, label:'Jerseys',            week:'9/17-9/23'},
      {idx:13, label:'Perf. Balls',        week:'9/24-9/30'},
    ]
  },
  {
    sheetId: '1hq7Y2o4gmdTWlL8ZQP-kgrprVNcLfr52sGHuPc9ogS4',
    gid: '1369682579',
    pctIdx: 14,
    notesIdx: 15,
    // Q4 tab: covers 10/2 through 12/31
    weekCols: [
      {idx:1,  label:'Grips/Slugs',        week:'10/2-10/8'},
      {idx:2,  label:'Jerseys',            week:'10/9-10/15'},
      {idx:3,  label:'Perf. Balls',        week:'10/16-10/22'},
      {idx:4,  label:'Towel/Shammy/Tape',  week:'10/23-10/29'},
      {idx:5,  label:'Gloves/Cleaners',    week:'10/30-11/5'},
      {idx:6,  label:'Shoes',              week:'11/6-11/12'},
      {idx:7,  label:'Poly/Entry',         week:'11/13-11/19'},
      {idx:8,  label:'Bags',               week:'11/20-11/26'},
      {idx:9,  label:'Grips/Slugs',        week:'11/27-12/3'},
      {idx:10, label:'Jerseys',            week:'12/4-12/10'},
      {idx:11, label:'Perf. Balls',        week:'12/11-12/17'},
      {idx:12, label:'Towel/Shammy/Tape',  week:'12/18-12/24'},
      {idx:13, label:'Gloves/Cleaners',    week:'12/25-12/31'},
    ]
  },
];

const DEPOSIT_SHEETS = [
  {
    sheetId: '1PSgVuPMDl5T5ggpe6Xby3xMNLBva7p0Z',
    month: 'January',
    tabs: [
      {label:'01.01-01.07', gid:'1904919088'},
      {label:'01.08-01.14', gid:'1552255859'},
      {label:'01.15-01.21', gid:'289684982'},
      {label:'01.22-01.28', gid:'1527928951'},
    ]
  },
  {
    sheetId: '14NSU5v2BKEcaYoeMQnfpFODufd2ImPsg',
    month: 'February',
    tabs: [
      {label:'01.29-02.04', gid:'1552255859'},
      {label:'02.05-02.11', gid:'2008148384'},
      {label:'02.12-02.18', gid:'289684982'},
      {label:'02.19-02.25', gid:'1527928951'},
    ]
  },
  {
    sheetId: '1YWUobtAzdRqVAJysMNSggS_cqsZXPoVG',
    month: 'March',
    tabs: [
      {label:'02.26-03.04', gid:'1552255859'},
      {label:'03.05-03.11', gid:'2008148384'},
      {label:'03.12-03.18', gid:'289684982'},
      {label:'03.19-03.25', gid:'1527928951'},
      {label:'03.26-04.01', gid:'1546845779'},
    ]
  },
  {
    sheetId: '1sej8Psc1JhhXbsNBhiOsQmFmLww_iTfv',
    month: 'April',
    tabs: [
      {label:'04.02-04.08', gid:'1552255859'},
      {label:'04.09-04.15', gid:'2008148384'},
      {label:'04.16-04.22', gid:'289684982'},
      {label:'04.23-04.29', gid:'1527928951'},
    ]
  },
  {
    sheetId: '1Ctv68KqcJHykBnbhjb9LV-lJmHxjVqVx',
    month: 'May',
    tabs: [
      {label:'04.30-05.06', gid:'1552255859'},
      {label:'05.07-05.13', gid:'2008148384'},
      {label:'05.14-05.20', gid:'289684982'},
      {label:'05.21-05.27', gid:'1527928951'},
    ]
  },
  {
    sheetId: '1t0ibs3mtBSk4kTe8GzoQNqNZTuyr8gSz',
    month: 'June',
    tabs: [
      {label:'05.28-06.03', gid:'1552255859'},
      {label:'06.04-06.10', gid:'2008148384'},
      {label:'06.11-06.17', gid:'289684982'},
      {label:'06.18-06.24', gid:'1527928951'},
      {label:'06.25-07.01', gid:'1546845779'},
    ]
  },
  {
    sheetId: '1VmlkHdkN2rkHfvmymrbGbW3aBGLHDsj3',
    month: 'July',
    tabs: [
      {label:'07.02-07.08', gid:'1552255859'},
      {label:'07.09-07.15', gid:'2008148384'},
      {label:'07.16-07.22', gid:'289684982'},
      {label:'07.23-07.29', gid:'1527928951'},
      {label:'07.30-08.05', gid:'1546845779'},
    ]
  },
];

const CASH_SHEET = {
  sheetId: '1276Rpf9zBpm_CYmjU3-LuNU5Wg1_nPvPwwBvITk6JV0',
  gid: '0',
  // Columns: A=Store, B=Jan%, C=Feb%, D=Mar%, E=Q1 Avg, F=Apr%, G=May%, H=June%
  monthCols: [
    {idx:1, label:'January'},
    {idx:2, label:'February'},
    {idx:3, label:'March'},
    {idx:5, label:'April'},
    {idx:6, label:'May'},
    {idx:7, label:'June'},
  ]
};

module.exports = { CYCLE_SHEETS, DEPOSIT_SHEETS, CASH_SHEET };

const STORE_LOCATIONS_SHEET = {
  sheetId: '1EEvOeTxqXnp4ImZk3bldTqbVES3rLYrQZx7wvBCXTDU',
  gid: '1416064869',
  // Columns (0-indexed): A=Name(0), B=c/o(1), C=Contact(2), D=Address(3), E=City(4), F=State(5), G=Zip(6), H=Phone(7), I=Email(8)
  nameIdx: 0,
  contactIdx: 2,
  emailIdx: 8,
};

module.exports.STORE_LOCATIONS_SHEET = STORE_LOCATIONS_SHEET;
