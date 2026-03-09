"use client"

import { Badge, Heading, Input, Label, Text } from "@medusajs/ui"
import React from "react"

import { applyGiftCard, removeGiftCard } from "@lib/data/cart"
import { HttpTypes } from "@medusajs/types"
import Trash from "@modules/common/icons/trash"
import ErrorMessage from "../error-message"
import { SubmitButton } from "../submit-button"

type GiftCardCodeProps = {
  cart: HttpTypes.StoreCart & {
    gift_cards?: { id?: string; code: string; is_disabled?: boolean }[]
  }
}

const GiftCardCode: React.FC<GiftCardCodeProps> = ({ cart }) => {
  const [isOpen, setIsOpen] = React.useState(false)
  const [errorMessage, setErrorMessage] = React.useState("")

  const giftCards = cart.gift_cards || []

  const onRemove = async (code: string) => {
    await removeGiftCard(code, giftCards as any)
  }

  const onAdd = async (formData: FormData) => {
    setErrorMessage("")

    const code = formData.get("code")?.toString().trim()
    if (!code) {
      return
    }

    const input = document.getElementById("giftcard-input") as HTMLInputElement

    try {
      await applyGiftCard(code)
    } catch (e: any) {
      setErrorMessage(e.message)
    }

    if (input) {
      input.value = ""
    }
  }

  return (
    <div className="w-full bg-white flex flex-col">
      <div className="txt-medium">
        <form action={(a) => onAdd(a)} className="w-full mb-5">
          <Label className="flex gap-x-1 my-2 items-center">
            <button
              onClick={() => setIsOpen(!isOpen)}
              type="button"
              className="txt-medium text-ui-fg-interactive hover:text-ui-fg-interactive-hover"
              data-testid="add-giftcard-button"
            >
              Add Gift Card
            </button>
          </Label>

          {isOpen && (
            <>
              <div className="flex w-full gap-x-2">
                <Input
                  className="size-full"
                  id="giftcard-input"
                  name="code"
                  type="text"
                  autoFocus={false}
                  data-testid="giftcard-input"
                />
                <SubmitButton variant="secondary" data-testid="giftcard-apply-button">
                  Apply
                </SubmitButton>
              </div>

              <ErrorMessage error={errorMessage} data-testid="giftcard-error-message" />
            </>
          )}
        </form>

        {giftCards.length > 0 && (
          <div className="w-full flex items-center">
            <div className="flex flex-col w-full">
              <Heading className="txt-medium mb-2">Gift card(s) applied:</Heading>

              {giftCards.map((gc) => {
                return (
                  <div
                    key={gc.id || gc.code}
                    className="flex items-center justify-between w-full max-w-full mb-2"
                    data-testid="giftcard-row"
                  >
                    <Text className="flex gap-x-1 items-baseline txt-small-plus w-4/5 pr-1">
                      <span className="truncate" data-testid="giftcard-code">
                        <Badge color={gc.is_disabled ? "red" : "grey"} size="small">
                          {gc.code}
                        </Badge>
                      </span>
                    </Text>
                    <button
                      className="flex items-center"
                      onClick={() => onRemove(gc.code)}
                      data-testid="remove-giftcard-button"
                    >
                      <Trash size={14} />
                      <span className="sr-only">Remove gift card from order</span>
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default GiftCardCode
