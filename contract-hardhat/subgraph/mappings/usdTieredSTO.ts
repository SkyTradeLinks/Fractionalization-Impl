import { TokenPurchase as TokenPurchaseSchema, MonthlyPurchaseAggregate,UserTokenPurchaseAggregate } from "../../generated/schema"
import { TokenPurchase } from "../../generated/templates/USDTieredSTO/USDTieredSTO"
import { BigInt } from "@graphprotocol/graph-ts";
export function handleTokenPurchase(event: TokenPurchase): void {
  const id = event.transaction.hash.toHex();
  let entity = TokenPurchaseSchema.load(id)
  if (!entity) {
    entity = new TokenPurchaseSchema(id)
  }
  entity.purchaser = event.params._purchaser;
  entity.beneficiary = event.params._beneficiary;
  entity.tokens = event.params._tokens;
  entity.usdAmount = event.params._usdAmount;
  entity.tierPrice = event.params._tierPrice;
  entity.tier = event.params._tier;
  entity.contractAddress = event.address;
  entity.timestamp = event.block.timestamp;
  entity.save()
  const date = new Date(event.block.timestamp.toI64() * 1000);
  const year = date.getUTCFullYear();
  const monthIndex = date.getUTCMonth();
  const purId = event.address.toHex() + "-" + year.toString() + "-" + monthIndex.toString();
  let purAgg = MonthlyPurchaseAggregate.load(purId);
  if (!purAgg) {
    purAgg = new MonthlyPurchaseAggregate(purId);
    purAgg.token = event.address.toHex();
    purAgg.year = year;
    purAgg.month = monthIndex;
    purAgg.totalUsd = BigInt.fromI32(0);
  }
  purAgg.totalUsd = purAgg.totalUsd.plus(event.params._usdAmount);
  purAgg.save();
  const upaId = event.params._purchaser.toHex() + "-" + event.address.toHex();
  let upa = UserTokenPurchaseAggregate.load(upaId);
  if (!upa) {
    upa = new UserTokenPurchaseAggregate(upaId);
    upa.user = event.params._purchaser.toHex();
    upa.token = event.address.toHex();
    upa.totalPurchased = BigInt.fromI32(0);
  }
  upa.totalPurchased = upa.totalPurchased.plus(event.params._usdAmount);
  upa.save();
}