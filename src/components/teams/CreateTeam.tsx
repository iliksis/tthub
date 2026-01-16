import { useRouteContext, useRouter } from "@tanstack/react-router";
import { ShieldPlusIcon } from "lucide-react";
import React from "react";
import { createTeam } from "@/api/teams";
import { useMutation } from "@/hooks/useMutation";
import { t } from "@/lib/text";
import { notify } from "../Toast";
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
		onSuccess: async (ctx) => {
			const data = await ctx.data.json();
			if (ctx.data?.status < 400) {
				await router.invalidate();
				notify({
					status: "success",
					title: data.message,
				});
				return;
			}
			notify({ status: "error", title: data.message });
		},
	});

	if (user?.role === "USER") return null;

	return (
		<>
			<button
				className="fab btn btn-circle btn-lg"
				type="button"
				onClick={onOpenCreate}
			>
				<ShieldPlusIcon className="size-4" />
			</button>
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
