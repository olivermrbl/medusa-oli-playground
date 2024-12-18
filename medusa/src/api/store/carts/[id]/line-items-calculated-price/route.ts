import { addToCartWorkflow } from "@medusajs/medusa/core-flows"

async function thirdPartyCallToComputePrice(item: any) {
  return {
    ...item,
    unit_price: Math.floor(Math.random() * 900) + 100,
  }
}

export const POST = async (req, res) => {
  const { id } = req.params
  const { items } = req.body

  const query = req.scope.resolve("query")

  const itemsWithDynamicPrice = await Promise.all(
    items.map((item) => {
      return thirdPartyCallToComputePrice(item)
    })
  )

  const workflowInput = {
    items: itemsWithDynamicPrice,
    cart_id: id,
  }

  await addToCartWorkflow(req.scope).run({
    input: workflowInput,
  })

  const updatedCart = await query.graph({
    entity: "cart",
    filters: { id },
    fields: ["id", "items.*"],
  })

  res.status(200).json({ cart: updatedCart })
}
