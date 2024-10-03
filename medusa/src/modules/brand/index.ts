import { Module } from "@medusajs/utils"
import BrandModuleService from "./service"

export const BrandModuleRegistrationKey = "brandModuleService"

export default Module(BrandModuleRegistrationKey, {
  service: BrandModuleService,
})
