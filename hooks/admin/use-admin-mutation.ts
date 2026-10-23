"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { errorMessage } from "@/data/leva-ja";
import { toast } from "@/stores/toast-store";

type Feedback<TResult> = {
  success: string | ((result: TResult) => string);
  description?: string | ((result: TResult) => string | undefined);
};

export function useAdminMutation<TInput, TResult>(
  mutationFn: (input: TInput) => Promise<TResult>,
  feedback: Feedback<TResult>,
) {
  const client = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: async (result) => {
      await client.invalidateQueries({ queryKey: ["admin"] });
      toast({
        title: typeof feedback.success === "function" ? feedback.success(result) : feedback.success,
        description: typeof feedback.description === "function" ? feedback.description(result) : feedback.description,
        tone: "success",
      });
    },
  });
}

export function mutationError(error: unknown) {
  return error ? errorMessage(error) : null;
}
