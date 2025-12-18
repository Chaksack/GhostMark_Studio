import WishlistClient from "@modules/wishlist/wishlist-client"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Your wishlist",
}

export default async function WishlistPage() {
  return <WishlistClient />
}
