// Turns raw computed stats into the "Key takeaways" lines used in the monthly
// email. A metric only gets an explicit callout when it moves enough to matter --
// otherwise it's listed plainly so the email doesn't cry wolf over normal noise.

const REVENUE_NOTABLE_PCT = 10;   // +/- 10% revenue swing gets called out
const COMPLIANCE_NOTABLE_PTS = 5; // +/- 5 percentage point compliance swing gets called out

function fmtMoney(n) {
  return '$' + Math.round(n).toLocaleString('en-US');
  }

  function fmtPct(n) {
    return `${n > 0 ? '+' : ''}${n}%`;
    }

    function revenueLine(label, val26, val25, changePct, openedDuring2025) {
      if (openedDuring2025) {
          return `${label}: ${fmtMoney(val26)} -- opened during 2025, year-over-year comparison not yet meaningful`;
            }
              const base = `${label}: ${fmtMoney(val26)} vs ${fmtMoney(val25)} last year (${fmtPct(changePct)})`;
                if (Math.abs(changePct) >= REVENUE_NOTABLE_PCT) {
                    const verdict = changePct > 0 ? 'up notably -- nice work' : 'down notably -- worth a look';
                        return `${base} -- ${verdict}`;
                          }
                            return base;
                            }

                            function complianceLine(label, val26, val25) {
                              if (val26 == null || val25 == null) {
                                  return `${label}: not enough data yet this year`;
                                    }
                                      const delta = Math.round((val26 - val25) * 10) / 10;
                                        const base = `${label}: ${val26}% YTD vs ${val25}% last year`;
                                          if (Math.abs(delta) >= COMPLIANCE_NOTABLE_PTS) {
                                              const verdict = delta > 0 ? 'up notably -- nice work' : 'down notably -- worth a look';
                                                  return `${base} -- ${verdict}`;
                                                    }
                                                      return base;
                                                      }

                                                      /**
                                                       * @param {object} revStats  output of computeRevenueStats()
                                                        * @param {object} compliance  {cash26, cash25, cycle26, cycle25, dep26, dep25}
                                                         * @returns {string[]} bullet lines for the email
                                                          */
                                                          function buildTakeaways(revStats, compliance) {
                                                            const lines = [];
                                                              lines.push(revenueLine(`Revenue (Jan-${revStats.lastMonthName})`, revStats.ytd26, revStats.ytd25, revStats.ytdChangePct, revStats.openedDuring2025));
                                                                lines.push(revenueLine(`Revenue (${revStats.lastMonthName})`, revStats.lastMonth26, revStats.lastMonth25, revStats.lastMonthChangePct, revStats.openedDuring2025));
                                                                  lines.push(complianceLine('Cycle count compliance', compliance.cycle26, compliance.cycle25));
                                                                    lines.push(complianceLine('Cash management compliance', compliance.cash26, compliance.cash25));
                                                                      lines.push(complianceLine('Deposit compliance', compliance.dep26, compliance.dep25));
                                                                        return lines;
                                                                        }

                                                                        module.exports = { buildTakeaways, REVENUE_NOTABLE_PCT, COMPLIANCE_NOTABLE_PTS };
                                                                        
