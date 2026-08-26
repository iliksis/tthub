import { useRouteContext, useRouter } from "@tanstack/react-router";
import { ShieldPlusIcon } from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { createTeam } from "@/api/teams";
import { Button } from "@/components/ui/button";
import { useMutation } from "@/hooks/useMutation";
import type { Season } from "@/lib/prisma/client";
import { t } from "@/lib/text";
import { TeamForm } from "./TeamForm";

type CreateTeamProps = {
	seasons: Season[];
	activeSeasonId?: string;
};

export const CreateTeam = ({ seasons, activeSeasonId }: CreateTeamProps) => {
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

	const hasSeasons = seasons.length > 0;

	return (
		<>
			<Button
				className="fab lg:hidden"
				variant="secondary"
				size="icon-lg"
				type="button"
				disabled={!hasSeasons}
				title={hasSeasons ? undefined : t("Create a season first")}
				onClick={onOpenCreate}
			>
				<ShieldPlusIcon className="size-4" />
			</Button>
			<Button
				className="hidden lg:flex"
				variant="default"
				size="sm"
				type="button"
				disabled={!hasSeasons}
				title={hasSeasons ? undefined : t("Create a season first")}
				onClick={onOpenCreate}
			>
				<ShieldPlusIcon className="size-4" />
				{t("Team")}
			</Button>
			<TeamForm
				open={isCreating}
				onClose={onStopCreating}
				submitLabel={t("Create")}
				seasonOptions={seasons}
				defaultValues={{
					clickTTGroupId: "",
					league: "",
					seasonId: activeSeasonId ?? seasons[0]?.id ?? "",
					title: "",
				}}
				onSubmit={async (values) => {
					await createTeamMutation.mutate({
						data: { ...values },
					});
				}}
			/>
		</>
	);
};
