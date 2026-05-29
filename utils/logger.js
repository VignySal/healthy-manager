const DEBUG = false

const log = (...args) => {
  if (DEBUG) console.log(...args)
}

const error = (...args) => {
  console.error(...args)
}

module.exports = { log, error }
