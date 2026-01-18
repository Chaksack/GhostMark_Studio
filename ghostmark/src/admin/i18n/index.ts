// Note: Avoid JSON import assertions (with { type: "json" }) since the Medusa Admin
// bundler may not support them and it can crash the dashboard with a white screen.
// Standard JSON imports are supported in the Admin toolchain.
import en from "./translations/en.json"

export default {
    en: {
        translation: en,
    },
}