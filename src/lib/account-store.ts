import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { deleteMyAccount } from "@/lib/account.functions";

/** Permanently deletes the current user's account and data. See account.functions.ts for exactly what's removed. */
export function useDeleteAccount() {
  const fn = useServerFn(deleteMyAccount);
  return useMutation({
    mutationFn: () => fn(),
  });
}
