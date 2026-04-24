(function () {
  function bootError(msg) {
    var el = document.getElementById('vac-app');
    if (el) el.innerHTML = '<div style="padding:24px;color:#991b1b;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;font-size:14px;"><strong>Failed to load configurator.</strong> ' + msg + '</div>';
  }
  if (!window.React || !window.ReactDOM || !window.htm) {
    bootError('Required scripts did not load. Check network connection.');
    return;
  }

  var React = window.React;
  var ReactDOM = window.ReactDOM;
  var useState = React.useState;
  var useMemo = React.useMemo;
  var useRef = React.useRef;
  var forwardRef = React.forwardRef;
  var html = window.htm.bind(React.createElement);

  // ── STATE DATA ──────────────────────────────────────────────────────────────
  // abbrRightLabel: "area_100kSqMi / statehoodYear"
  // defaultCities[].rightLabel: "popRank / zipPrefix"

  var STATES = {
    AL: { abbr:'AL', name:'Alabama', svgViewBox:'0 0 60 100',
      svgPath:'M 5 0 L 55 0 L 57 40 L 55 75 L 42 100 L 10 100 L 5 65 Z',
      abbrRightLabel:'1.9 / 1819',
      defaultCities:[{label:'BHAM',rightLabel:'1 / 35'},{label:'MOBIL',rightLabel:'4 / 36'},{label:'MONTGY',rightLabel:'2 / 36'},{label:'HSVILL',rightLabel:'3 / 35'},{label:'TUSCAL',rightLabel:'5 / 35'},{label:'AUBURN',rightLabel:'9 / 36'}] },
    AK: { abbr:'AK', name:'Alaska', svgViewBox:'0 0 120 90',
      svgPath:'M 15 30 L 45 5 L 85 10 L 110 30 L 105 60 L 85 80 L 55 85 L 25 70 L 10 50 Z',
      abbrRightLabel:'663K / 1959',
      defaultCities:[{label:'ANCH',rightLabel:'1 / 99'},{label:'FAIR',rightLabel:'2 / 99'},{label:'JNEAU',rightLabel:'3 / 99'},{label:'SITKA',rightLabel:'4 / 99'},{label:'KETCH',rightLabel:'5 / 99'},{label:'KODIAK',rightLabel:'6 / 99'}] },
    AZ: { abbr:'AZ', name:'Arizona', svgViewBox:'0 0 100 110',
      svgPath:'M 2 2 L 96 2 L 96 78 L 70 78 L 70 92 L 55 104 L 35 104 L 0 88 L 0 6 Z',
      abbrRightLabel:'2.14 / 1912',
      defaultCities:[{label:'PHX',rightLabel:'10 / 86'},{label:'FLAG',rightLabel:'69 / 09'},{label:'TEMPE',rightLabel:'11 / 65'},{label:'TUCSON',rightLabel:'23 / 89'},{label:'GILBERT',rightLabel:'12 / 37'},{label:'SCTTSDL',rightLabel:'12 / 47'}] },
    AR: { abbr:'AR', name:'Arkansas', svgViewBox:'0 0 90 90',
      svgPath:'M 0 0 L 85 0 L 88 5 L 88 88 L 5 88 L 0 50 Z',
      abbrRightLabel:'2.0 / 1836',
      defaultCities:[{label:'LR',rightLabel:'1 / 72'},{label:'FTSMITH',rightLabel:'2 / 72'},{label:'FAYETT',rightLabel:'3 / 72'},{label:'SPRING',rightLabel:'4 / 72'},{label:'JONESB',rightLabel:'5 / 72'},{label:'NLR',rightLabel:'6 / 72'}] },
    CA: { abbr:'CA', name:'California', svgViewBox:'0 0 100 180',
      svgPath:'M 12 0 L 62 0 L 62 40 L 100 90 L 100 140 L 70 180 L 0 180 L 0 30 Z',
      abbrRightLabel:'9.9 / 1850',
      defaultCities:[{label:'LA',rightLabel:'10 / 81'},{label:'SF',rightLabel:'4 / 50'},{label:'SANDGO',rightLabel:'7 / 69'},{label:'SAC',rightLabel:'2 / 18'},{label:'FRESNO',rightLabel:'5 / 42'},{label:'SNJS',rightLabel:'10 / 08'}] },
    CO: { abbr:'CO', name:'Colorado', svgViewBox:'0 0 110 80',
      svgPath:'M 0 0 L 110 0 L 110 80 L 0 80 Z',
      abbrRightLabel:'10.4 / 1876',
      defaultCities:[{label:'DENV',rightLabel:'1 / 80'},{label:'CSPRGS',rightLabel:'2 / 80'},{label:'AURORA',rightLabel:'3 / 80'},{label:'FTCOL',rightLabel:'4 / 80'},{label:'LAKEWD',rightLabel:'5 / 80'},{label:'PUEBLO',rightLabel:'6 / 80'}] },
    CT: { abbr:'CT', name:'Connecticut', svgViewBox:'0 0 50 60',
      svgPath:'M 0 0 L 50 0 L 50 58 L 5 58 L 0 40 Z',
      abbrRightLabel:'0.55 / 1788',
      defaultCities:[{label:'BRIDGPT',rightLabel:'1 / 06'},{label:'NHVN',rightLabel:'2 / 06'},{label:'HRTFD',rightLabel:'3 / 06'},{label:'STAMFD',rightLabel:'4 / 06'},{label:'WATBRY',rightLabel:'5 / 06'},{label:'NORWLK',rightLabel:'6 / 06'}] },
    DE: { abbr:'DE', name:'Delaware', svgViewBox:'0 0 40 70',
      svgPath:'M 5 0 L 38 5 L 40 40 L 35 70 L 5 70 L 0 40 Z',
      abbrRightLabel:'0.19 / 1787',
      defaultCities:[{label:'WILM',rightLabel:'1 / 19'},{label:'DOVR',rightLabel:'2 / 19'},{label:'NEWRK',rightLabel:'3 / 19'},{label:'MIDWN',rightLabel:'4 / 19'},{label:'SMYRNA',rightLabel:'5 / 19'},{label:'MILFD',rightLabel:'6 / 19'}] },
    FL: { abbr:'FL', name:'Florida', svgViewBox:'0 0 130 100',
      svgPath:'M 0 0 L 90 0 L 95 15 L 100 30 L 110 45 L 120 60 L 125 80 L 115 95 L 95 100 L 80 85 L 70 65 L 50 50 L 30 45 L 10 30 Z',
      abbrRightLabel:'3.3 / 1845',
      defaultCities:[{label:'MIA',rightLabel:'7 / 96'},{label:'ORL',rightLabel:'7 / 75'},{label:'TAMPA',rightLabel:'7 / 55'},{label:'JACKSVL',rightLabel:'10 / 91'},{label:'TLH',rightLabel:'11 / 25'},{label:'FTLAUD',rightLabel:'3 / 27'}] },
    GA: { abbr:'GA', name:'Georgia', svgViewBox:'0 0 90 100',
      svgPath:'M 0 0 L 85 0 L 90 15 L 90 60 L 65 100 L 20 100 L 0 80 L 5 40 Z',
      abbrRightLabel:'5.2 / 1788',
      defaultCities:[{label:'ATL',rightLabel:'1 / 30'},{label:'AUGUST',rightLabel:'2 / 30'},{label:'CLMBS',rightLabel:'3 / 31'},{label:'SAVNAH',rightLabel:'4 / 31'},{label:'ATHENS',rightLabel:'5 / 30'},{label:'MACON',rightLabel:'6 / 31'}] },
    HI: { abbr:'HI', name:'Hawaii', svgViewBox:'0 0 100 60',
      svgPath:'M 15 30 L 35 10 L 60 5 L 85 15 L 95 35 L 80 55 L 55 58 L 25 50 Z',
      abbrRightLabel:'1.05 / 1959',
      defaultCities:[{label:'HNLLU',rightLabel:'1 / 96'},{label:'PEARL',rightLabel:'2 / 96'},{label:'HILO',rightLabel:'3 / 96'},{label:'KAILUA',rightLabel:'4 / 96'},{label:'KNEHE',rightLabel:'5 / 96'},{label:'MILILNI',rightLabel:'6 / 96'}] },
    ID: { abbr:'ID', name:'Idaho', svgViewBox:'0 0 80 130',
      svgPath:'M 30 0 L 78 0 L 78 50 L 65 50 L 65 128 L 10 128 L 5 100 L 10 60 L 5 30 Z',
      abbrRightLabel:'8.7 / 1890',
      defaultCities:[{label:'BOISE',rightLabel:'1 / 83'},{label:'NMPA',rightLabel:'2 / 83'},{label:'MRDIAN',rightLabel:'3 / 83'},{label:'IDAHOF',rightLabel:'4 / 83'},{label:'POCATL',rightLabel:'5 / 83'},{label:'CALDWL',rightLabel:'6 / 83'}] },
    IL: { abbr:'IL', name:'Illinois', svgViewBox:'0 0 70 130',
      svgPath:'M 5 0 L 65 0 L 68 20 L 70 60 L 55 100 L 40 130 L 25 128 L 15 110 L 10 80 L 0 50 L 2 20 Z',
      abbrRightLabel:'5.7 / 1818',
      defaultCities:[{label:'CHI',rightLabel:'1 / 60'},{label:'AURORA',rightLabel:'2 / 60'},{label:'JOLIET',rightLabel:'3 / 60'},{label:'ROCFD',rightLabel:'4 / 61'},{label:'SPRING',rightLabel:'5 / 62'},{label:'NAPRVL',rightLabel:'6 / 60'}] },
    IN: { abbr:'IN', name:'Indiana', svgViewBox:'0 0 70 100',
      svgPath:'M 5 0 L 68 0 L 70 25 L 68 80 L 55 100 L 15 100 L 0 80 L 2 25 Z',
      abbrRightLabel:'3.6 / 1816',
      defaultCities:[{label:'INDPLS',rightLabel:'1 / 46'},{label:'FW',rightLabel:'2 / 46'},{label:'EVANVL',rightLabel:'3 / 47'},{label:'SOUTHB',rightLabel:'4 / 46'},{label:'CARMEL',rightLabel:'5 / 46'},{label:'MUNCIE',rightLabel:'7 / 47'}] },
    IA: { abbr:'IA', name:'Iowa', svgViewBox:'0 0 110 90',
      svgPath:'M 0 10 L 20 0 L 90 0 L 110 15 L 110 80 L 85 90 L 15 88 L 0 70 Z',
      abbrRightLabel:'5.6 / 1846',
      defaultCities:[{label:'DMOINE',rightLabel:'1 / 50'},{label:'CDRPDS',rightLabel:'2 / 52'},{label:'DAVNPT',rightLabel:'3 / 52'},{label:'SIOUX',rightLabel:'4 / 51'},{label:'WTRLOO',rightLabel:'5 / 50'},{label:'AMES',rightLabel:'8 / 50'}] },
    KS: { abbr:'KS', name:'Kansas', svgViewBox:'0 0 120 80',
      svgPath:'M 0 0 L 120 0 L 120 80 L 15 80 L 0 65 Z',
      abbrRightLabel:'8.2 / 1861',
      defaultCities:[{label:'WICHITA',rightLabel:'1 / 67'},{label:'OPKCY',rightLabel:'2 / 66'},{label:'TOPEKA',rightLabel:'3 / 66'},{label:'OLATHE',rightLabel:'4 / 66'},{label:'LNWOOD',rightLabel:'5 / 66'},{label:'LWNWRTH',rightLabel:'6 / 66'}] },
    KY: { abbr:'KY', name:'Kentucky', svgViewBox:'0 0 150 70',
      svgPath:'M 0 20 L 30 5 L 80 0 L 120 5 L 148 15 L 150 40 L 130 65 L 80 70 L 40 65 L 10 55 Z',
      abbrRightLabel:'4.1 / 1792',
      defaultCities:[{label:'LVILLE',rightLabel:'1 / 40'},{label:'LXNGTN',rightLabel:'2 / 40'},{label:'BOWLNG',rightLabel:'3 / 42'},{label:'OWNSB',rightLabel:'4 / 42'},{label:'CVNGTN',rightLabel:'5 / 41'},{label:'HOPKVL',rightLabel:'6 / 42'}] },
    LA: { abbr:'LA', name:'Louisiana', svgViewBox:'0 0 100 100',
      svgPath:'M 0 0 L 80 0 L 80 40 L 100 50 L 95 65 L 80 60 L 75 80 L 60 100 L 40 98 L 30 80 L 20 85 L 5 75 L 0 50 Z',
      abbrRightLabel:'5.2 / 1812',
      defaultCities:[{label:'NWORL',rightLabel:'1 / 70'},{label:'BATON',rightLabel:'2 / 70'},{label:'SHVPT',rightLabel:'3 / 71'},{label:'METAIR',rightLabel:'4 / 70'},{label:'ALEXNDR',rightLabel:'5 / 71'},{label:'LAYFTT',rightLabel:'6 / 70'}] },
    ME: { abbr:'ME', name:'Maine', svgViewBox:'0 0 90 130',
      svgPath:'M 20 0 L 80 0 L 88 30 L 90 80 L 70 120 L 45 130 L 20 120 L 5 90 L 0 50 L 10 20 Z',
      abbrRightLabel:'3.5 / 1820',
      defaultCities:[{label:'PORTLD',rightLabel:'1 / 04'},{label:'LEWIS',rightLabel:'2 / 04'},{label:'BANGR',rightLabel:'3 / 04'},{label:'AUBURN',rightLabel:'5 / 04'},{label:'BIDFRD',rightLabel:'6 / 04'},{label:'SACO',rightLabel:'7 / 04'}] },
    MD: { abbr:'MD', name:'Maryland', svgViewBox:'0 0 150 70',
      svgPath:'M 0 30 L 40 0 L 110 5 L 148 20 L 150 45 L 120 65 L 70 70 L 30 65 L 5 50 Z',
      abbrRightLabel:'1.24 / 1788',
      defaultCities:[{label:'BLTMR',rightLabel:'1 / 21'},{label:'COLMBA',rightLabel:'2 / 21'},{label:'GRNBLT',rightLabel:'3 / 20'},{label:'SILVER',rightLabel:'4 / 20'},{label:'BOWIE',rightLabel:'5 / 20'},{label:'FRDCK',rightLabel:'6 / 21'}] },
    MA: { abbr:'MA', name:'Massachusetts', svgViewBox:'0 0 130 70',
      svgPath:'M 0 25 L 40 0 L 95 0 L 130 10 L 128 40 L 110 65 L 70 70 L 35 68 L 5 55 Z',
      abbrRightLabel:'1.07 / 1788',
      defaultCities:[{label:'BSTN',rightLabel:'1 / 02'},{label:'WORCST',rightLabel:'2 / 01'},{label:'SPFLD',rightLabel:'3 / 01'},{label:'LOWELL',rightLabel:'4 / 01'},{label:'CAMBDG',rightLabel:'5 / 02'},{label:'BROCKTN',rightLabel:'6 / 02'}] },
    MI: { abbr:'MI', name:'Michigan', svgViewBox:'0 0 90 120',
      svgPath:'M 20 0 L 55 0 L 75 15 L 90 40 L 85 70 L 70 90 L 55 105 L 35 110 L 20 105 L 5 85 L 0 60 L 10 25 Z',
      abbrRightLabel:'9.6 / 1837',
      defaultCities:[{label:'DETRT',rightLabel:'1 / 48'},{label:'GRPDS',rightLabel:'2 / 49'},{label:'WRREN',rightLabel:'3 / 48'},{label:'STRLNG',rightLabel:'4 / 48'},{label:'LNSNG',rightLabel:'5 / 48'},{label:'ANNABR',rightLabel:'6 / 48'}] },
    MN: { abbr:'MN', name:'Minnesota', svgViewBox:'0 0 110 130',
      svgPath:'M 30 0 L 80 0 L 100 10 L 110 45 L 108 90 L 90 130 L 50 128 L 10 120 L 0 80 L 5 40 L 20 10 Z',
      abbrRightLabel:'8.6 / 1858',
      defaultCities:[{label:'MPLS',rightLabel:'1 / 55'},{label:'STPAUL',rightLabel:'2 / 55'},{label:'RCHSTR',rightLabel:'3 / 55'},{label:'DLUTH',rightLabel:'4 / 55'},{label:'BLMNGTN',rightLabel:'5 / 55'},{label:'BRKLYN',rightLabel:'6 / 55'}] },
    MS: { abbr:'MS', name:'Mississippi', svgViewBox:'0 0 70 120',
      svgPath:'M 5 0 L 65 0 L 68 30 L 70 75 L 60 110 L 35 120 L 15 115 L 5 90 L 0 50 Z',
      abbrRightLabel:'4.8 / 1817',
      defaultCities:[{label:'JACKSN',rightLabel:'1 / 39'},{label:'GULFPT',rightLabel:'2 / 39'},{label:'STHVN',rightLabel:'3 / 39'},{label:'HATBG',rightLabel:'4 / 39'},{label:'BILOXI',rightLabel:'5 / 39'},{label:'MRDIAN',rightLabel:'6 / 39'}] },
    MO: { abbr:'MO', name:'Missouri', svgViewBox:'0 0 110 100',
      svgPath:'M 0 15 L 25 0 L 85 0 L 110 20 L 110 60 L 90 90 L 65 100 L 30 98 L 5 80 Z',
      abbrRightLabel:'6.9 / 1821',
      defaultCities:[{label:'KCMO',rightLabel:'1 / 64'},{label:'STLOU',rightLabel:'2 / 63'},{label:'SPRFLD',rightLabel:'3 / 65'},{label:'COLMBA',rightLabel:'4 / 65'},{label:'INDPND',rightLabel:'5 / 64'},{label:'STJOS',rightLabel:'6 / 64'}] },
    MT: { abbr:'MT', name:'Montana', svgViewBox:'0 0 140 90',
      svgPath:'M 0 20 L 60 0 L 140 0 L 140 90 L 0 90 Z',
      abbrRightLabel:'14.7 / 1889',
      defaultCities:[{label:'BLNGS',rightLabel:'1 / 59'},{label:'MSSULA',rightLabel:'2 / 59'},{label:'GTFALL',rightLabel:'3 / 59'},{label:'BSMAN',rightLabel:'4 / 59'},{label:'HLEANA',rightLabel:'5 / 59'},{label:'KALSPLL',rightLabel:'6 / 59'}] },
    NE: { abbr:'NE', name:'Nebraska', svgViewBox:'0 0 130 80',
      svgPath:'M 0 0 L 130 0 L 130 65 L 90 80 L 0 80 Z',
      abbrRightLabel:'7.7 / 1867',
      defaultCities:[{label:'OMAHA',rightLabel:'1 / 68'},{label:'LNCOLN',rightLabel:'2 / 68'},{label:'BLVUE',rightLabel:'3 / 68'},{label:'GRNDIS',rightLabel:'4 / 68'},{label:'KEARNY',rightLabel:'5 / 68'},{label:'HASTNG',rightLabel:'6 / 68'}] },
    NV: { abbr:'NV', name:'Nevada', svgViewBox:'0 0 90 130',
      svgPath:'M 20 0 L 88 0 L 90 80 L 65 130 L 0 130 L 5 70 Z',
      abbrRightLabel:'11.0 / 1864',
      defaultCities:[{label:'LSVGS',rightLabel:'1 / 89'},{label:'HNDRSN',rightLabel:'2 / 89'},{label:'RENO',rightLabel:'3 / 89'},{label:'NRTHLS',rightLabel:'4 / 89'},{label:'SPRKS',rightLabel:'5 / 89'},{label:'CRSN',rightLabel:'6 / 89'}] },
    NH: { abbr:'NH', name:'New Hampshire', svgViewBox:'0 0 60 110',
      svgPath:'M 15 0 L 55 0 L 58 10 L 60 50 L 55 90 L 40 110 L 10 108 L 0 85 L 5 50 L 12 20 Z',
      abbrRightLabel:'0.92 / 1788',
      defaultCities:[{label:'MNCHTR',rightLabel:'1 / 03'},{label:'NASHUA',rightLabel:'2 / 03'},{label:'CONCRD',rightLabel:'3 / 03'},{label:'DERRY',rightLabel:'4 / 03'},{label:'RCHSTR',rightLabel:'5 / 03'},{label:'KEENE',rightLabel:'6 / 03'}] },
    NJ: { abbr:'NJ', name:'New Jersey', svgViewBox:'0 0 60 100',
      svgPath:'M 10 0 L 55 5 L 60 30 L 55 70 L 40 100 L 10 95 L 0 70 L 5 30 Z',
      abbrRightLabel:'0.79 / 1787',
      defaultCities:[{label:'NWRK',rightLabel:'1 / 07'},{label:'JRSCTY',rightLabel:'2 / 07'},{label:'PATRN',rightLabel:'3 / 07'},{label:'ELIZBT',rightLabel:'4 / 07'},{label:'LKWD',rightLabel:'5 / 08'},{label:'EDSON',rightLabel:'6 / 08'}] },
    NM: { abbr:'NM', name:'New Mexico', svgViewBox:'0 0 100 110',
      svgPath:'M 0 0 L 80 0 L 82 5 L 100 5 L 100 110 L 0 110 Z',
      abbrRightLabel:'12.1 / 1912',
      defaultCities:[{label:'ABQRQ',rightLabel:'1 / 87'},{label:'LSCRCS',rightLabel:'2 / 88'},{label:'RSWLL',rightLabel:'3 / 88'},{label:'SFENTA',rightLabel:'4 / 87'},{label:'CLOVIS',rightLabel:'5 / 88'},{label:'HBBS',rightLabel:'6 / 88'}] },
    NY: { abbr:'NY', name:'New York', svgViewBox:'0 0 140 90',
      svgPath:'M 0 40 L 25 30 L 40 15 L 55 5 L 70 0 L 95 10 L 110 20 L 130 15 L 140 30 L 135 55 L 120 80 L 100 85 L 80 90 L 55 85 L 40 75 L 25 65 L 10 55 Z',
      abbrRightLabel:'7.26 / 1788',
      defaultCities:[{label:'NYC',rightLabel:'10 / 01'},{label:'BUF',rightLabel:'4 / 32'},{label:'ROCH',rightLabel:'4 / 23'},{label:'SYRACSE',rightLabel:'12 / 14'},{label:'ALBANY',rightLabel:'7 / 22'},{label:'YNKRS',rightLabel:'4 / 07'}] },
    NC: { abbr:'NC', name:'North Carolina', svgViewBox:'0 0 160 80',
      svgPath:'M 0 30 L 35 10 L 80 0 L 130 5 L 160 20 L 158 50 L 135 70 L 90 80 L 45 78 L 10 65 Z',
      abbrRightLabel:'5.3 / 1789',
      defaultCities:[{label:'CHRLTE',rightLabel:'1 / 28'},{label:'RALEGH',rightLabel:'2 / 27'},{label:'GRNSBR',rightLabel:'3 / 27'},{label:'DURHM',rightLabel:'4 / 27'},{label:'WINSTN',rightLabel:'5 / 27'},{label:'FAYETT',rightLabel:'6 / 28'}] },
    ND: { abbr:'ND', name:'North Dakota', svgViewBox:'0 0 120 80',
      svgPath:'M 0 10 L 30 0 L 120 0 L 120 80 L 0 80 Z',
      abbrRightLabel:'7.0 / 1889',
      defaultCities:[{label:'FARGO',rightLabel:'1 / 58'},{label:'BSMRCK',rightLabel:'2 / 58'},{label:'GRNDFK',rightLabel:'3 / 58'},{label:'MNOT',rightLabel:'4 / 58'},{label:'WSTFGO',rightLabel:'5 / 58'},{label:'DCKNSN',rightLabel:'6 / 58'}] },
    OH: { abbr:'OH', name:'Ohio', svgViewBox:'0 0 90 110',
      svgPath:'M 15 0 L 70 0 L 88 20 L 90 60 L 80 100 L 55 110 L 20 108 L 0 85 L 5 50 L 10 20 Z',
      abbrRightLabel:'4.4 / 1803',
      defaultCities:[{label:'COLMBS',rightLabel:'1 / 43'},{label:'CLVLND',rightLabel:'2 / 44'},{label:'CINCI',rightLabel:'3 / 45'},{label:'TOLEDO',rightLabel:'4 / 43'},{label:'AKRON',rightLabel:'5 / 44'},{label:'DAYTON',rightLabel:'6 / 45'}] },
    OK: { abbr:'OK', name:'Oklahoma', svgViewBox:'0 0 140 80',
      svgPath:'M 0 0 L 60 0 L 60 30 L 140 30 L 140 80 L 0 80 Z',
      abbrRightLabel:'6.9 / 1907',
      defaultCities:[{label:'OKLCTY',rightLabel:'1 / 73'},{label:'TULSA',rightLabel:'2 / 74'},{label:'NRMN',rightLabel:'3 / 73'},{label:'BRKN',rightLabel:'4 / 74'},{label:'MDWST',rightLabel:'5 / 73'},{label:'LWTN',rightLabel:'6 / 73'}] },
    OR: { abbr:'OR', name:'Oregon', svgViewBox:'0 0 110 90',
      svgPath:'M 0 25 L 30 0 L 110 0 L 110 90 L 0 90 Z',
      abbrRightLabel:'9.7 / 1859',
      defaultCities:[{label:'PORTLD',rightLabel:'1 / 97'},{label:'SALEM',rightLabel:'2 / 97'},{label:'EUGENE',rightLabel:'3 / 97'},{label:'GRSHAM',rightLabel:'4 / 97'},{label:'HLLSBR',rightLabel:'5 / 97'},{label:'BEND',rightLabel:'6 / 97'}] },
    PA: { abbr:'PA', name:'Pennsylvania', svgViewBox:'0 0 120 80',
      svgPath:'M 0 20 L 30 0 L 120 0 L 120 75 L 10 80 L 0 60 Z',
      abbrRightLabel:'4.6 / 1787',
      defaultCities:[{label:'PHILA',rightLabel:'1 / 19'},{label:'PITTS',rightLabel:'2 / 15'},{label:'ALTNWN',rightLabel:'3 / 18'},{label:'ERLE',rightLabel:'4 / 16'},{label:'RDING',rightLabel:'5 / 19'},{label:'SCRNTN',rightLabel:'6 / 18'}] },
    RI: { abbr:'RI', name:'Rhode Island', svgViewBox:'0 0 30 50',
      svgPath:'M 5 0 L 28 0 L 30 20 L 25 50 L 5 48 L 0 30 Z',
      abbrRightLabel:'0.10 / 1790',
      defaultCities:[{label:'PROVDC',rightLabel:'1 / 02'},{label:'CRANST',rightLabel:'2 / 02'},{label:'WOSNSK',rightLabel:'3 / 02'},{label:'PAWT',rightLabel:'4 / 02'},{label:'EPTPVD',rightLabel:'5 / 02'},{label:'NWPRT',rightLabel:'6 / 02'}] },
    SC: { abbr:'SC', name:'South Carolina', svgViewBox:'0 0 90 80',
      svgPath:'M 0 0 L 80 0 L 90 30 L 70 70 L 40 80 L 10 75 L 0 40 Z',
      abbrRightLabel:'3.2 / 1788',
      defaultCities:[{label:'COLMBA',rightLabel:'1 / 29'},{label:'CHLSTN',rightLabel:'2 / 29'},{label:'NCHOLS',rightLabel:'3 / 29'},{label:'MYRTLE',rightLabel:'4 / 29'},{label:'SPARTN',rightLabel:'5 / 29'},{label:'HILTN',rightLabel:'6 / 29'}] },
    SD: { abbr:'SD', name:'South Dakota', svgViewBox:'0 0 120 80',
      svgPath:'M 0 0 L 120 0 L 120 80 L 0 80 Z',
      abbrRightLabel:'7.7 / 1889',
      defaultCities:[{label:'SIOUX',rightLabel:'1 / 57'},{label:'RAPID',rightLabel:'2 / 57'},{label:'ABRDEEN',rightLabel:'3 / 57'},{label:'BRKNGS',rightLabel:'4 / 57'},{label:'WTTWN',rightLabel:'5 / 57'},{label:'MICHWL',rightLabel:'6 / 57'}] },
    TN: { abbr:'TN', name:'Tennessee', svgViewBox:'0 0 160 70',
      svgPath:'M 0 20 L 30 5 L 90 0 L 140 5 L 160 20 L 155 50 L 130 65 L 80 70 L 35 68 L 5 55 Z',
      abbrRightLabel:'4.2 / 1796',
      defaultCities:[{label:'MMPHS',rightLabel:'1 / 38'},{label:'NSHVLL',rightLabel:'2 / 37'},{label:'KNXVLL',rightLabel:'3 / 37'},{label:'CHTNOO',rightLabel:'4 / 37'},{label:'CLRKSVL',rightLabel:'5 / 37'},{label:'MRFRESBR',rightLabel:'6 / 37'}] },
    TX: { abbr:'TX', name:'Texas', svgViewBox:'0 0 120 110',
      svgPath:'M 10 0 L 80 0 L 80 10 L 115 15 L 120 55 L 90 90 L 75 100 L 60 108 L 45 100 L 35 85 L 20 80 L 8 60 L 0 40 L 5 10 Z',
      abbrRightLabel:'12.29 / 1845',
      defaultCities:[{label:'HOU',rightLabel:'7 / 13'},{label:'DAL',rightLabel:'2 / 41'},{label:'AUS',rightLabel:'7 / 85'},{label:'SANANT',rightLabel:'5 / 18'},{label:'FTWRTH',rightLabel:'6 / 07'},{label:'ELPASO',rightLabel:'5 / 15'}] },
    UT: { abbr:'UT', name:'Utah', svgViewBox:'0 0 90 120',
      svgPath:'M 25 0 L 90 0 L 90 120 L 0 120 L 0 50 Z',
      abbrRightLabel:'8.4 / 1896',
      defaultCities:[{label:'SLC',rightLabel:'1 / 84'},{label:'WJORDN',rightLabel:'2 / 84'},{label:'WVLY',rightLabel:'3 / 84'},{label:'PROVO',rightLabel:'4 / 84'},{label:'OREM',rightLabel:'5 / 84'},{label:'SANDY',rightLabel:'6 / 84'}] },
    VT: { abbr:'VT', name:'Vermont', svgViewBox:'0 0 50 100',
      svgPath:'M 10 0 L 48 5 L 50 30 L 45 80 L 30 100 L 10 98 L 0 70 L 2 30 Z',
      abbrRightLabel:'0.97 / 1791',
      defaultCities:[{label:'BRLNGTN',rightLabel:'1 / 05'},{label:'STHBRL',rightLabel:'2 / 05'},{label:'RUTLND',rightLabel:'3 / 05'},{label:'BNNGTN',rightLabel:'4 / 05'},{label:'BRMNGTN',rightLabel:'5 / 05'},{label:'ESSEX',rightLabel:'6 / 05'}] },
    VA: { abbr:'VA', name:'Virginia', svgViewBox:'0 0 140 80',
      svgPath:'M 0 30 L 30 10 L 80 0 L 130 10 L 140 35 L 130 60 L 95 75 L 55 80 L 20 70 L 0 50 Z',
      abbrRightLabel:'4.2 / 1788',
      defaultCities:[{label:'VABCH',rightLabel:'1 / 23'},{label:'NORFK',rightLabel:'2 / 23'},{label:'CHRSVL',rightLabel:'3 / 22'},{label:'RCHMD',rightLabel:'4 / 23'},{label:'ARLINGT',rightLabel:'5 / 22'},{label:'ALEX',rightLabel:'6 / 22'}] },
    WA: { abbr:'WA', name:'Washington', svgViewBox:'0 0 120 90',
      svgPath:'M 0 25 L 30 0 L 100 0 L 120 10 L 120 90 L 0 90 Z',
      abbrRightLabel:'7.1 / 1889',
      defaultCities:[{label:'SEATTLE',rightLabel:'1 / 98'},{label:'SPKANE',rightLabel:'2 / 99'},{label:'TACMA',rightLabel:'3 / 98'},{label:'VNCVR',rightLabel:'4 / 98'},{label:'BLLVUE',rightLabel:'5 / 98'},{label:'KRKLAND',rightLabel:'6 / 98'}] },
    WV: { abbr:'WV', name:'West Virginia', svgViewBox:'0 0 100 100',
      svgPath:'M 0 40 L 20 10 L 45 0 L 75 10 L 100 35 L 95 65 L 70 90 L 45 100 L 20 90 L 5 70 Z',
      abbrRightLabel:'2.4 / 1863',
      defaultCities:[{label:'CHLSTN',rightLabel:'1 / 25'},{label:'HNNGTN',rightLabel:'2 / 25'},{label:'MORGTWN',rightLabel:'3 / 26'},{label:'PARKRSB',rightLabel:'4 / 26'},{label:'WHEEL',rightLabel:'5 / 26'},{label:'BECKLLY',rightLabel:'6 / 25'}] },
    WI: { abbr:'WI', name:'Wisconsin', svgViewBox:'0 0 90 120',
      svgPath:'M 20 0 L 65 0 L 85 15 L 90 50 L 80 90 L 60 115 L 30 120 L 10 105 L 0 70 L 5 30 Z',
      abbrRightLabel:'6.6 / 1848',
      defaultCities:[{label:'MLWKEE',rightLabel:'1 / 53'},{label:'MADSON',rightLabel:'2 / 53'},{label:'GNBAY',rightLabel:'3 / 54'},{label:'KSHUWA',rightLabel:'4 / 53'},{label:'RACINE',rightLabel:'5 / 53'},{label:'APPWTN',rightLabel:'6 / 54'}] },
    WY: { abbr:'WY', name:'Wyoming', svgViewBox:'0 0 120 100',
      svgPath:'M 0 0 L 120 0 L 120 100 L 0 100 Z',
      abbrRightLabel:'9.7 / 1890',
      defaultCities:[{label:'CHYENN',rightLabel:'1 / 82'},{label:'CASPER',rightLabel:'2 / 82'},{label:'LRMIE',rightLabel:'3 / 82'},{label:'GLLT',rightLabel:'4 / 82'},{label:'ROCKSP',rightLabel:'5 / 82'},{label:'SHRIDN',rightLabel:'6 / 82'}] }
  };

  var STATE_KEYS = Object.keys(STATES);
  var ACUITY = ['20/200','20/100','20/70','20/50','20/40','20/30','20/20','20/15'];

  var FONTS = [
    { key:'dm-sans',  label:'DM Sans',          stack:"'DM Sans', system-ui, sans-serif" },
    { key:'inter',    label:'Inter',             stack:"'Inter', system-ui, sans-serif" },
    { key:'helvetica',label:'Helvetica',         stack:"'Helvetica Neue', Helvetica, Arial, sans-serif" },
    { key:'dm-serif', label:'DM Serif Display',  stack:"'DM Serif Display', Georgia, serif" },
    { key:'playfair', label:'Playfair Display',  stack:"'Playfair Display', Georgia, serif" },
    { key:'mono',     label:'Roboto Mono',       stack:"'Roboto Mono', ui-monospace, monospace" }
  ];

  var FRAMES = {
    maple:  { label:'Maple',  gradient:'linear-gradient(135deg,#e8d2a4 0%,#c9a46e 50%,#e8d2a4 100%)' },
    walnut: { label:'Walnut', gradient:'linear-gradient(135deg,#8b6f47 0%,#4d3a20 50%,#8b6f47 100%)' },
    black:  { label:'Black',  gradient:'linear-gradient(135deg,#3a3a3a 0%,#0a0a0a 50%,#3a3a3a 100%)' },
    white:  { label:'White',  gradient:'linear-gradient(135deg,#fafafa 0%,#e2e2dc 50%,#fafafa 100%)' },
    gold:   { label:'Gold',   gradient:'linear-gradient(135deg,#e6c358 0%,#a8851a 50%,#e6c358 100%)' },
    cherry: { label:'Cherry', gradient:'linear-gradient(135deg,#a0522d 0%,#6b2e1a 50%,#a0522d 100%)' }
  };
  var FRAME_KEYS = Object.keys(FRAMES);

  var PRINT_SIZES = {
    '11x14': { w:11, h:14, label:'11″ \xd7 14″' },
    '16x20': { w:16, h:20, label:'16″ \xd7 20″' },
    '18x24': { w:18, h:24, label:'18″ \xd7 24″' },
    '24x36': { w:24, h:36, label:'24″ \xd7 36″' }
  };

  // ── HELPERS ─────────────────────────────────────────────────────────────────

  function buildDefault(stateKey) {
    var s = STATES[stateKey];
    var cities = s.defaultCities.slice();
    while (cities.length < 6) cities.push({ label:'', rightLabel:'' });
    return {
      stateKey: stateKey,
      abbrRightLabel: s.abbrRightLabel || '',
      cities: cities.slice(0, 6),
      footerTitle: 'VISION ART CO.',
      footerSubtitle: '2026 // CHANDLER, AZ',
      justifyWidth: 300,
      fontStack: FONTS[0].stack,
      bgType: 'solid',
      bgColor1: '#fafaf7',
      bgColor2: '#ffffff',
      bgAngle: 180,
      frameColor: 'maple',
      printSize: '18x24'
    };
  }

  function gradientCoords(angleDeg) {
    var rad = angleDeg * Math.PI / 180;
    var dx = Math.sin(rad), dy = -Math.cos(rad);
    return { x1: 0.5 - 0.5*dx, y1: 0.5 - 0.5*dy, x2: 0.5 + 0.5*dx, y2: 0.5 + 0.5*dy };
  }

  // ── CHART SVG ────────────────────────────────────────────────────────────────

  var ChartSVG = forwardRef(function ChartSVG(props, ref) {
    var config = props.config;
    var state = STATES[config.stateKey];
    if (!state) return null;

    var W = 800, H = 1100, MARGIN = 48, CX = W / 2;
    var SIL_CY = 175, SIL_MAX = 170;
    var vb = state.svgViewBox.split(/\s+/).map(Number);
    var vbW = vb[2], vbH = vb[3];
    var scale = Math.min(SIL_MAX / vbW, SIL_MAX / vbH);
    var silW = vbW * scale, silH = vbH * scale;
    var ROW_Y = [SIL_CY, 355, 475, 570, 650, 720, 782, 838];
    var SIZES = [0, 108, 92, 72, 56, 46, 38, 32];
    var LEFT_X = 90, RIGHT_X = W - 90;

    var padded = config.cities.slice();
    while (padded.length < 6) padded.push({ label:'', rightLabel:'' });

    var g = gradientCoords(config.bgAngle);

    var leftLabels = ACUITY.map(function (label, i) {
      var parts = label.split('/');
      return html`
        <g key=${'L'+i} transform=${'translate('+LEFT_X+','+ROW_Y[i]+')'}>
          <text x="-2" y="-6" textAnchor="end" fontSize="14" fill="#111" fontWeight="500">${parts[0]}</text>
          <line x1="-28" y1="0" x2="2" y2="0" stroke="#111" strokeWidth="0.8" />
          <text x="-2" y="14" textAnchor="end" fontSize="14" fill="#111" fontWeight="500">${parts[1]}</text>
        </g>
      `;
    });

    var rightData = [config.abbrRightLabel].concat(padded.slice(0,6).map(function(c){ return c.rightLabel || ''; }));
    var rightLabels = rightData.map(function (raw, idx) {
      if (!raw) return null;
      var rowIdx = idx + 1;
      var parts = raw.split('/').map(function(s){ return s.trim(); });
      if (parts.length !== 2) {
        return html`<text key=${'R'+idx} x=${RIGHT_X} y=${ROW_Y[rowIdx]} fontSize="14" fill="#111">${raw}</text>`;
      }
      return html`
        <g key=${'R'+idx} transform=${'translate('+RIGHT_X+','+ROW_Y[rowIdx]+')'}>
          <text x="0" y="-6" fontSize="14" fill="#111" fontWeight="500">${parts[0]}</text>
          <line x1="-2" y1="0" x2="32" y2="0" stroke="#111" strokeWidth="0.8" />
          <text x="0" y="14" fontSize="14" fill="#111" fontWeight="500">${parts[1]}</text>
        </g>
      `;
    });

    var cityRows = padded.slice(0,6).map(function (c, i) {
      if (!c.label) return null;
      return html`
        <text key=${'C'+i}
              x=${CX} y=${ROW_Y[i+2]}
              textAnchor="middle" dominantBaseline="middle"
              fontSize=${SIZES[i+2]} fontWeight="600" fill="#111"
              textLength=${config.justifyWidth}
              lengthAdjust="spacingAndGlyphs">
          ${c.label}
        </text>
      `;
    });

    return html`
      <svg ref=${ref}
           xmlns="http://www.w3.org/2000/svg"
           viewBox=${'0 0 '+W+' '+H}
           width="100%" height="100%"
           style=${{ fontFamily: config.fontStack, display:'block' }}>
        <defs>
          <linearGradient id="vaBgGrad" x1=${g.x1} y1=${g.y1} x2=${g.x2} y2=${g.y2}>
            <stop offset="0%" stopColor=${config.bgColor1} />
            <stop offset="100%" stopColor=${config.bgColor2} />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width=${W} height=${H}
              fill=${config.bgType === 'gradient' ? 'url(#vaBgGrad)' : config.bgColor1} />
        <rect x=${MARGIN} y=${MARGIN} width=${W-MARGIN*2} height=${H-MARGIN*2}
              fill="none" stroke="#111" strokeWidth="1" />
        <g transform=${'translate('+(CX-silW/2)+','+(SIL_CY-silH/2)+') scale('+scale+')'}>
          <path d=${state.svgPath} fill="#111" />
        </g>
        <text x=${CX} y=${ROW_Y[1]}
              textAnchor="middle" dominantBaseline="middle"
              fontSize=${SIZES[1]} fontWeight="700" fill="#111" letterSpacing="4">
          ${state.abbr}
        </text>
        ${cityRows}
        ${leftLabels}
        ${rightLabels}
        <g transform=${'translate('+(W-220)+','+(H-130)+')'}>
          <rect x="0" y="0" width="170" height="60" fill="none" stroke="#111" strokeWidth="0.8" />
          <text x="12" y="20" fontSize="11" fontWeight="700" letterSpacing="1" fill="#111">
            ${(config.footerTitle || '').toUpperCase()}
          </text>
          <line x1="0" y1="32" x2="170" y2="32" stroke="#111" strokeWidth="0.5" />
          <text x="12" y="48" fontSize="9" fill="#111" letterSpacing="0.5">
            ${config.footerSubtitle || ''}
          </text>
        </g>
      </svg>
    `;
  });

  // ── EXPORT UTILS ─────────────────────────────────────────────────────────────

  function serialize(svg) {
    var c = svg.cloneNode(true);
    c.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    c.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    return new XMLSerializer().serializeToString(c);
  }
  function dl(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
  }
  function exportSVG(svg, filename) {
    dl(new Blob([serialize(svg)], { type:'image/svg+xml;charset=utf-8' }), filename);
  }
  function rasterize(svg, pxW, pxH) {
    var src = serialize(svg);
    var url = URL.createObjectURL(new Blob([src], { type:'image/svg+xml;charset=utf-8' }));
    return new Promise(function(resolve, reject) {
      var img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = function() {
        try {
          var canvas = document.createElement('canvas');
          canvas.width = pxW; canvas.height = pxH;
          canvas.getContext('2d').drawImage(img, 0, 0, pxW, pxH);
          URL.revokeObjectURL(url);
          resolve(canvas);
        } catch(e) { URL.revokeObjectURL(url); reject(e); }
      };
      img.onerror = function(){ URL.revokeObjectURL(url); reject(new Error('SVG rasterization failed')); };
      img.src = url;
    });
  }
  function exportPNG(svg, filename) {
    return rasterize(svg, 2400, 3300).then(function(canvas) {
      return new Promise(function(res, rej) {
        canvas.toBlob(function(b){ if (!b) return rej(new Error('toBlob failed')); dl(b, filename); res(); }, 'image/png');
      });
    });
  }
  function computeFit(chartAspect, pageW, pageH) {
    var pageAspect = pageW / pageH;
    var cW, cH;
    if (chartAspect >= pageAspect) { cW = pageW; cH = pageW / chartAspect; }
    else { cH = pageH; cW = pageH * chartAspect; }
    return { w:cW, h:cH, x:(pageW-cW)/2, y:(pageH-cH)/2 };
  }
  function exportPDF(svg, filename, printSize) {
    if (!window.jspdf) return Promise.reject(new Error('jsPDF not loaded'));
    var size = PRINT_SIZES[printSize];
    var fit = computeFit(800/1100, size.w, size.h);
    var MAX_DIM = 5400;
    var pxW = fit.w * 300, pxH = fit.h * 300;
    var maxAxis = Math.max(pxW, pxH);
    if (maxAxis > MAX_DIM) { var sc = MAX_DIM/maxAxis; pxW *= sc; pxH *= sc; }
    pxW = Math.round(pxW); pxH = Math.round(pxH);
    return rasterize(svg, pxW, pxH).then(function(canvas) {
      var dataUrl = canvas.toDataURL('image/jpeg', 0.95);
      var jsPDF = window.jspdf.jsPDF;
      var pdf = new jsPDF({ orientation:'portrait', unit:'in', format:[size.w, size.h] });
      pdf.setFillColor(255,255,255);
      pdf.rect(0, 0, size.w, size.h, 'F');
      pdf.addImage(dataUrl, 'JPEG', fit.x, fit.y, fit.w, fit.h);
      pdf.save(filename);
    });
  }

  // ── APP ──────────────────────────────────────────────────────────────────────

  function App() {
    var s = useState('AZ'); var stateKey = s[0]; var setStateKey = s[1];
    var c = useState(function(){ return buildDefault('AZ'); });
    var config = c[0]; var setConfig = c[1];
    var svgRef = useRef(null);
    var b = useState(null); var busy = b[0]; var setBusy = b[1];

    var activeState = useMemo(function(){ return STATES[stateKey]; }, [stateKey]);
    var activeFrame = FRAMES[config.frameColor] || FRAMES.maple;
    var activeSize = PRINT_SIZES[config.printSize];

    function handleStateChange(e) {
      var next = e.target.value;
      setStateKey(next);
      setConfig(function(prev) {
        var fresh = buildDefault(next);
        return Object.assign(fresh, {
          fontStack: prev.fontStack, bgType: prev.bgType,
          bgColor1: prev.bgColor1, bgColor2: prev.bgColor2,
          bgAngle: prev.bgAngle, frameColor: prev.frameColor,
          printSize: prev.printSize, justifyWidth: prev.justifyWidth
        });
      });
    }
    function updateConfig(patch) { setConfig(function(p){ return Object.assign({},p,patch); }); }
    function updateCity(i, patch) {
      setConfig(function(p) {
        return Object.assign({},p,{ cities: p.cities.map(function(cty,idx){ return idx===i ? Object.assign({},cty,patch) : cty; }) });
      });
    }
    function resetCities() {
      var fresh = buildDefault(stateKey);
      updateConfig({ abbrRightLabel: fresh.abbrRightLabel, cities: fresh.cities });
    }
    function doExport(kind) {
      if (!svgRef.current) return;
      var base = 'vision-art-' + activeState.abbr.toLowerCase();
      setBusy(kind);
      var done = function(){ setBusy(null); };
      var fail = function(err){ console.error(err); alert('Export failed: '+err.message); setBusy(null); };
      try {
        if (kind==='svg') { exportSVG(svgRef.current, base+'.svg'); done(); }
        else if (kind==='png') exportPNG(svgRef.current, base+'.png').then(done, fail);
        else exportPDF(svgRef.current, base+'.pdf', config.printSize).then(done, fail);
      } catch(err) { fail(err); }
    }

    var hints = ['20/70','20/50','20/40','20/30','20/20','20/15'];

    function ColorField(props) {
      return html`
        <div className="vac-color-picker">
          <input type="color" value=${props.value} onChange=${function(e){ props.onChange(e.target.value); }} />
          <input className="input vac-color-hex" value=${props.value} onChange=${function(e){ props.onChange(e.target.value); }} />
        </div>`;
    }

    var stateOptions = STATE_KEYS.map(function(k){
      return html`<option key=${k} value=${k}>${STATES[k].name} (${k})</option>`;
    });

    var cityInputs = config.cities.map(function(cty, i){
      return html`
        <div key=${i} className="vac-row-3">
          <div className="vac-mono">${hints[i]}</div>
          <input className="input upper" value=${cty.label}
            onChange=${function(e){ updateCity(i,{label:e.target.value}); }}
            placeholder="CITY" />
          <input className="input" value=${cty.rightLabel||''}
            onChange=${function(e){ updateCity(i,{rightLabel:e.target.value}); }}
            placeholder="1 / 85" />
        </div>`;
    });

    var frameSwatches = FRAME_KEYS.map(function(k){
      return html`
        <button key=${k} className=${'vac-swatch'+(config.frameColor===k?' active':'')}
                style=${{ background: FRAMES[k].gradient }}
                title=${FRAMES[k].label}
                onClick=${function(){ updateConfig({frameColor:k}); }} />`;
    });
    var frameLabels = FRAME_KEYS.map(function(k){
      return html`<div key=${k}>${FRAMES[k].label}</div>`;
    });

    return html`
      <div className="vac-grid">

        <!-- ── Left: Controls ── -->
        <div>

          <!-- State + Content -->
          <div className="vac-panel">
            <div className="vac-panel-title">Chart Content</div>
            <div className="vac-stack">
              <div className="vac-field">
                <label className="vac-label">State</label>
                <select className="select" value=${stateKey} onChange=${handleStateChange}>
                  ${stateOptions}
                </select>
              </div>
              <div className="vac-field">
                <label className="vac-label">Row 1 annotation</label>
                <input className="input" value=${config.abbrRightLabel}
                  onChange=${function(e){ updateConfig({abbrRightLabel:e.target.value}); }}
                  placeholder="2.14 / 1912" />
              </div>
            </div>
            <div className="vac-subsection">
              <div style=${{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'10px'}}>
                <div className="vac-subsection-title" style=${{margin:0}}>Cities</div>
                <button className="btn btn-ghost btn-sm" onClick=${resetCities}>↺ Reset</button>
              </div>
              <div className="vac-stack-sm">${cityInputs}</div>
              <div className="vac-muted">Columns: acuity row · city abbreviation · annotation</div>
            </div>
          </div>

          <!-- Design -->
          <div className="vac-panel">
            <div className="vac-panel-title">Design</div>

            <div className="vac-stack-sm">
              <div className="vac-subsection-title">Row justification width</div>
              <div className="vac-slider-row">
                <input type="range" min="150" max="500" step="1" className="vac-slider"
                  value=${config.justifyWidth}
                  onChange=${function(e){ updateConfig({justifyWidth:Number(e.target.value)}); }} />
                <span className="vac-slider-value">${config.justifyWidth}px</span>
              </div>
              <div className="vac-muted">Controls inter-letter spacing across all city rows.</div>
            </div>

            <div className="vac-subsection">
              <div className="vac-subsection-title">Typography</div>
              <select className="select" value=${config.fontStack}
                onChange=${function(e){ updateConfig({fontStack:e.target.value}); }}>
                ${FONTS.map(function(f){ return html`<option key=${f.key} value=${f.stack}>${f.label}</option>`; })}
              </select>
            </div>

            <div className="vac-subsection">
              <div className="vac-subsection-title">Background</div>
              <div className="vac-tab-group" style=${{marginBottom:'10px'}}>
                <button className=${'vac-tab-btn'+(config.bgType==='solid'?' active':'')}
                        onClick=${function(){ updateConfig({bgType:'solid'}); }}>Solid</button>
                <button className=${'vac-tab-btn'+(config.bgType==='gradient'?' active':'')}
                        onClick=${function(){ updateConfig({bgType:'gradient'}); }}>Gradient</button>
              </div>
              ${config.bgType==='solid'
                ? html`<${ColorField} value=${config.bgColor1} onChange=${function(v){ updateConfig({bgColor1:v}); }} />`
                : html`<div className="vac-stack-sm">
                    <div className="vac-field"><label className="vac-label">Start</label><${ColorField} value=${config.bgColor1} onChange=${function(v){ updateConfig({bgColor1:v}); }} /></div>
                    <div className="vac-field"><label className="vac-label">End</label><${ColorField} value=${config.bgColor2} onChange=${function(v){ updateConfig({bgColor2:v}); }} /></div>
                    <div className="vac-field">
                      <label className="vac-label">Angle</label>
                      <div className="vac-slider-row">
                        <input type="range" min="0" max="360" step="1" className="vac-slider"
                          value=${config.bgAngle}
                          onChange=${function(e){ updateConfig({bgAngle:Number(e.target.value)}); }} />
                        <span className="vac-slider-value">${config.bgAngle}°</span>
                      </div>
                    </div>
                  </div>`}
            </div>

            <div className="vac-subsection">
              <div className="vac-subsection-title">Frame</div>
              <div className="vac-swatch-grid">${frameSwatches}</div>
              <div className="vac-swatch-labels">${frameLabels}</div>
            </div>
          </div>

          <!-- Footer Stamp -->
          <div className="vac-panel">
            <div className="vac-panel-title">Footer Stamp</div>
            <div className="vac-stack-sm">
              <div className="vac-field">
                <label className="vac-label">Title</label>
                <input className="input" value=${config.footerTitle}
                  onChange=${function(e){ updateConfig({footerTitle:e.target.value}); }} />
              </div>
              <div className="vac-field">
                <label className="vac-label">Subtitle</label>
                <input className="input" value=${config.footerSubtitle}
                  onChange=${function(e){ updateConfig({footerSubtitle:e.target.value}); }} />
              </div>
            </div>
          </div>

          <!-- Export -->
          <div className="vac-panel">
            <div className="vac-panel-title">Export File</div>
            <div className="vac-stack-sm">
              <div className="vac-field">
                <label className="vac-label">Print size</label>
                <select className="select" value=${config.printSize}
                  onChange=${function(e){ updateConfig({printSize:e.target.value}); }}>
                  ${Object.keys(PRINT_SIZES).map(function(k){
                    return html`<option key=${k} value=${k}>${PRINT_SIZES[k].label}</option>`;
                  })}
                </select>
              </div>
              <div className="vac-row-exports" style=${{marginTop:'4px'}}>
                <button className="btn btn-outline btn-sm" disabled=${!!busy} onClick=${function(){ doExport('png'); }}>
                  ${busy==='png' ? '…' : 'PNG'}
                </button>
                <button className="btn btn-outline btn-sm" disabled=${!!busy} onClick=${function(){ doExport('svg'); }}>
                  ${busy==='svg' ? '…' : 'SVG'}
                </button>
                <button className="btn btn-outline btn-sm" disabled=${!!busy} onClick=${function(){ doExport('pdf'); }}>
                  ${busy==='pdf' ? '…' : 'PDF'}
                </button>
              </div>
              <div className="vac-muted">PDF at 300 DPI on ${activeSize.label}. Chart is fit to page with white margins.</div>
            </div>
          </div>

          <!-- Order CTA -->
          <div className="vac-order-cta">
            <div class="text-[13px] text-zinc-500 dark:text-zinc-400 mb-3">Configure your chart above, then sign in to place a print order.</div>
            <a href="login.html" className="btn btn-primary w-full" style=${{width:'100%',justifyContent:'center'}}>
              <svg style=${{width:'16px',height:'16px',strokeWidth:'2',stroke:'currentColor',fill:'none',strokeLinecap:'round',strokeLinejoin:'round'}} viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
              Sign in to order a print
            </a>
          </div>

        </div>

        <!-- ── Right: Preview ── -->
        <div className="vac-sticky">
          <div className="vac-preview-card">
            <div className="vac-frame" style=${{ background: activeFrame.gradient }}>
              <div className="vac-mat">
                <${ChartSVG} ref=${svgRef} config=${config} />
              </div>
            </div>
            <div className="vac-size-label">${activeSize.label} · ${activeFrame.label} frame</div>
          </div>
        </div>

      </div>
    `;
  }

  // ── MOUNT ────────────────────────────────────────────────────────────────────
  try {
    var root = ReactDOM.createRoot(document.getElementById('vac-app'));
    root.render(html`<${App} />`);
  } catch (err) {
    bootError('React mount error: ' + err.message);
    console.error(err);
  }
})();
