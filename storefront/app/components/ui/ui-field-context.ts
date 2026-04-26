import type { ComputedRef, InjectionKey } from 'vue'

export interface UiFieldContext {
  id: ComputedRef<string>
  invalid: ComputedRef<boolean>
  describedById: ComputedRef<string | undefined>
  required: ComputedRef<boolean>
}

export const UiFieldKey: InjectionKey<UiFieldContext> = Symbol('UiField')
