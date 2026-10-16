// Order status flow and labels. Isomorphic, so client components can use them.
import type { OrderStatus } from "./types";

export const ORDER_FLOW: Record<OrderStatus, OrderStatus[]> = {
  pending: ["paid", "cancelled"],
  paid: ["processing", "shipped", "refunded"],
  processing: ["shipped", "refunded"],
  shipped: ["delivered", "refunded"],
  delivered: ["completed", "refunded"],
  completed: ["refunded"],
  cancelled: [],
  refunded: [],
};

export const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Awaiting payment",
  paid: "Paid (in escrow)",
  processing: "Processing",
  shipped: "Shipped / ready at hub",
  delivered: "Delivered",
  completed: "Completed",
  cancelled: "Cancelled",
  refunded: "Refunded",
};
