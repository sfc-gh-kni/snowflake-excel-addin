declare namespace CustomFunctions {
  class Error {
    constructor(code: ErrorCode, message?: string);
  }
  enum ErrorCode {
    divisionByZero = "#DIV/0!",
    invalidValue = "#VALUE!",
    notAvailable = "#N/A",
    nullReference = "#NULL!",
    numberError = "#NUM!",
    timeout = "#TIMEOUT!",
    valueNotAvailable = "#N/A",
  }
}
