// Top-level admin extension entry to expose i18n to the Medusa admin dashboard.
// Some versions of the Admin loader expect a default export containing the i18n
// map. Supplying it avoids a silent runtime error that can result in a white screen.

import i18n from "./i18n"

const config = { i18n }

export default config
export { i18n }
