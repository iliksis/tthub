import { useRouter } from "@tanstack/react-router";
import { UserPlus2Icon } from "lucide-react";
import React from "react";
import { createPlayer } from "@/api/players";
import { useMutation } from "@/hooks/useMutation";
import { notify } from "../Toast";
import { PlayerForm } from "./PlayerForm";

export const CreatePlayer = () => {
	const router = useRouter();

	const [isCreating, setIsCreating] = React.useState(false);

	const onOpenCreate = () => {
		setIsCreating(true);
	};
	const onStopCreating = () => {
		setIsCreating(false);
	};

	const createPlayerMutation = useMutation({
		fn: createPlayer,
		onSuccess: async (ctx) => {
			const data = await ctx.data.json();
			if (ctx.data?.status < 400) {
				await router.invalidate();
				notify({
					text: data.message,
					status: "success",
				});
				return;
			}
			notify({ text: data.message, status: "error" });
		},
	});

	return (
		<>
			<button
				className="fab btn btn-circle btn-lg"
				type="button"
				onClick={onOpenCreate}
			>
				<UserPlus2Icon className="size-4" />
			</button>
			<PlayerForm
				open={isCreating}
				onClose={onStopCreating}
				submitLabel="Create"
				onSubmit={async (values) => {
					await createPlayerMutation.mutate({
						data: { ...values },
					});
				}}
			/>
		</>
	);
};
