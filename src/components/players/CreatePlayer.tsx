import { useRouteContext, useRouter } from "@tanstack/react-router";
import { UserPlus2Icon } from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { createPlayer } from "@/api/players";
import { Button } from "@/components/ui/button";
import { useMutation } from "@/hooks/useMutation";
import { t } from "@/lib/text";
import { PlayerForm } from "./PlayerForm";

export const CreatePlayer = () => {
	const { user } = useRouteContext({ from: "__root__" });
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
		onError: (err) => {
			toast.error(err.message);
		},
		onSuccess: async (ctx) => {
			await router.invalidate();
			toast.success(ctx.data.message);
		},
	});

	if (user?.role === "USER") return null;

	return (
		<>
			<Button
				className="fab lg:hidden"
				variant="secondary"
				size="icon-lg"
				type="button"
				onClick={onOpenCreate}
			>
				<UserPlus2Icon className="size-4" />
			</Button>
			<Button
				className="hidden lg:flex"
				variant="default"
				size="sm"
				type="button"
				onClick={onOpenCreate}
			>
				<UserPlus2Icon className="size-4" />
				{t("Player")}
			</Button>
			<PlayerForm
				open={isCreating}
				onClose={onStopCreating}
				submitLabel={t("Create")}
				onSubmit={async (values) => {
					await createPlayerMutation.mutate({
						data: { ...values },
					});
				}}
			/>
		</>
	);
};
