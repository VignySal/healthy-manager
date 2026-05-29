const DEBUG: boolean = false

export const log = (...args: unknown[]): void => {
  if (DEBUG) console.log(...args)
}

export const error = (...args: unknown[]): void => {
  console.error(...args)
}
