import { Navigate, useLocation } from "react-router";

/** `/expenses`: Transactions is the first tab (Overview arrives in phase 3). */
export function Component() {
  const { search } = useLocation();
  return <Navigate to={{ pathname: "/expenses/transactions", search }} replace />;
}
