import { model } from "@medusajs/utils"

const Brand = model.define("brand", {
  id: model.id({ prefix: "bra" }).primaryKey(),
  name: model.text(),
  description: model.text().nullable(),
})

export default Brand
