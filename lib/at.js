exports.receivedSignalStrengthIndicatorMap = {
  2: {dBm: -109, condition: 'Marginal'},
  3: {dBm: -107, condition: 'Marginal'},
  4: {dBm: -105, condition: 'Marginal'},
  5: {dBm: -103, condition: 'Marginal'},
  6: {dBm: -101, condition: 'Marginal'},
  7: {dBm: -99, condition: 'Marginal'},
  8: {dBm: -97, condition: 'Marginal'},
  9: {dBm: -95, condition: 'Marginal'},
  10: {dBm: -93, condition: 'OK'},
  11: {dBm: -91, condition: 'OK'},
  12: {dBm: -89, condition: 'OK'},
  13: {dBm: -87, condition: 'OK'},
  14: {dBm: -85, condition: 'OK'},
  15: {dBm: -83, condition: 'Good'},
  16: {dBm: -81, condition: 'Good'},
  17: {dBm: -79, condition: 'Good'},
  18: {dBm: -77, condition: 'Good'},
  19: {dBm: -75, condition: 'Good'},
  20: {dBm: -73, condition: 'Excellent'},
  21: {dBm: -71, condition: 'Excellent'},
  22: {dBm: -69, condition: 'Excellent'},
  23: {dBm: -67, condition: 'Excellent'},
  24: {dBm: -65, condition: 'Excellent'},
  25: {dBm: -63, condition: 'Excellent'},
  26: {dBm: -61, condition: 'Excellent'},
  27: {dBm: -59, condition: 'Excellent'},
  28: {dBm: -57, condition: 'Excellent'},
  29: {dBm: -55, condition: 'Excellent'},
  30: {dBm: -53, condition: 'Excellent'}
}

exports.registrationStatusMap = {
  0: {description: 'not registered, MT is not currently searching a new operator to register to'},
  1: {description: 'registered, home network'},
  2: {description: 'not registered, but MT is currently searching a new operator to register to'},
  3: {description: 'registration denied'},
  4: {description: 'unknown (e.g. out of GERAN/UTRAN/E-UTRAN coverage)'},
  5: {description: 'registered, roaming'},
  6: {description: 'registered for "SMS only", home network (applicable only when indicates E-UTRAN)'},
  7: {description: 'registered for "SMS only", roaming (applicable only when indicates E-UTRAN)'},
  8: {description: 'attached for emergency bearer services only (see NOTE 2) (not applicable)'},
  9: {description: 'registered for "CSFB not preferred", home network (applicable only when indicates E-UTRAN)'},
  10: {description: 'registered for "CSFB not preferred", roaming (applicable only when indicates E-UTRAN)'}
}

exports.accessTechnologyMap = {
  0: {description: 'GSM'},
  1: {description: 'GSM Compact'},
  2: {description: 'UTRAN'},
  3: {description: 'GSM w/EGPRS'},
  4: {description: 'UTRAN w/HSDPA'},
  5: {description: 'UTRAN w/HSUPA'},
  6: {description: 'UTRAN w/HSDPA and HSUPA'},
  7: {description: 'E-UTRAN'}
}

exports.packetDomainServiceStatusMap = {
  0: {description: 'not attached'},
  1: {description: 'attached'}
}
