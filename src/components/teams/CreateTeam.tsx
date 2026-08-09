import { useRouteContext, useRouter } from "@tanstack/react-router";
import { ShieldPlusIcon } from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { createTeam } from "@/api/teams";
import { Button } from "@/components/ui/button";
import { useMutation } from "@/hooks/useMutation";
import { t } from "@/lib/text";
import { TeamForm } from "./TeamForm";

export const CreateTeam = () => {
	const { user } = useRouteContext({ from: "__root__" });
	const router = useRouter();

	const [isCreating, setIsCreating] = React.useState(false);

	const onOpenCreate = () => {
		setIsCreating(true);
	};
	const onStopCreating = () => {
		setIsCreating(false);
	};

	const createTeamMutation = useMutation({
		fn: createTeam,
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
				<ShieldPlusIcon className="size-4" />
			</Button>
			<Button
				className="hidden lg:flex"
				variant="default"
				size="sm"
				type="button"
				onClick={onOpenCreate}
			>
				<ShieldPlusIcon className="size-4" />
				{t("Team")}
			</Button>
			<TeamForm
				open={isCreating}
				onClose={onStopCreating}
				submitLabel={t("Create")}
				onSubmit={async (values) => {
					await createTeamMutation.mutate({
						data: { ...values },
					});
				}}
			/>
		</>
	);
};
