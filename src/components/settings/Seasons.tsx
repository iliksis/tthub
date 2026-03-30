import { useForm } from "@tanstack/react-form";
import { useRouter } from "@tanstack/react-router";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { createSeason, deleteSeason } from "@/api/seasons";
import { DetailsList } from "@/components/DetailsList";
import { useMutation } from "@/hooks/useMutation";
import {
	AGE_GROUP_KEYS,
	getAgeGroupLabel,
	type SeasonWithAgeGroupCounts,
} from "@/lib/statistics";
import { t } from "@/lib/text";

type SeasonsProps = {
	seasons: SeasonWithAgeGroupCounts[];
};

const formatDate = (date: Date) => {
	return new Intl.DateTimeFormat("de-DE", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
	}).format(date);
};

const formatAgeGroupCounts = (season: SeasonWithAgeGroupCounts) => {
	const counts = new Map(
		season.ageGroupCounts.map((count) => [count.ageGroup, count.playerCount]),
	);

	return AGE_GROUP_KEYS.map((ageGroup) => {
		return `${getAgeGroupLabel(ageGroup)}: ${counts.get(ageGroup) ?? 0}`;
	}).join(" · ");
};

export const Seasons = ({ seasons }: SeasonsProps) => {
	const router = useRouter();
	const createSeasonMutation = useMutation({
		fn: createSeason,
		onSuccess: async (ctx) => {
			const data = await ctx.data.json();
			if (ctx.data.status < 400) {
				await router.invalidate();
				toast.success(data.message);
				form.reset();
				return;
			}

			toast.error(data.message);
		},
	});

	const form = useForm({
		defaultValues: {
			endDate: "",
			startDate: "",
		},
		onSubmit: async ({ value }) => {
			createSeasonMutation.mutate({
				data: {
					endDate: new Date(value.endDate),
					startDate: new Date(value.startDate),
				},
			});
		},
	});

	const deleteMutation = useMutation({
		fn: deleteSeason,
		onSuccess: async (ctx) => {
			const data = await ctx.data.json();
			if (ctx.data?.status < 400) {
				await router.invalidate();
				toast.success(data.message);
				return;
			}
			toast.error(data.message);
		},
	});

	const onDelete = (seasonId: string) => async () => {
		deleteMutation.mutate({
			data: {
				id: seasonId,
			},
		});
	};

	return (
		<div className="flex flex-col gap-6">
			<div className="card bg-base-200 shadow-sm">
				<form
					className="card-body gap-4"
					onSubmit={(event) => {
						event.preventDefault();
						event.stopPropagation();
						form.handleSubmit();
					}}
				>
					<div>
						<h2 className="card-title text-base">{t("Create season")}</h2>
						<p className="text-sm text-base-content/70">
							{t(
								"Player counts are generated automatically from current players",
							)}
						</p>
					</div>
					<div className="grid gap-4 md:grid-cols-2">
						<form.Field name="startDate">
							{(field) => (
								<fieldset className="fieldset">
									<label className="label" htmlFor={field.name}>
										{t("Season start date")}
									</label>
									<input
										className="input input-primary w-full"
										id={field.name}
										name={field.name}
										onBlur={field.handleBlur}
										onChange={(event) => field.handleChange(event.target.value)}
										type="date"
										value={field.state.value}
									/>
								</fieldset>
							)}
						</form.Field>
						<form.Field name="endDate">
							{(field) => (
								<fieldset className="fieldset">
									<label className="label" htmlFor={field.name}>
										{t("Season end date")}
									</label>
									<input
										className="input input-primary w-full"
										id={field.name}
										name={field.name}
										onBlur={field.handleBlur}
										onChange={(event) => field.handleChange(event.target.value)}
										type="date"
										value={field.state.value}
									/>
								</fieldset>
							)}
						</form.Field>
					</div>
					<div className="card-actions justify-end">
						<form.Subscribe selector={(state) => state.isSubmitting}>
							{(isSubmitting) => (
								<button className="btn btn-primary" type="submit">
									<PlusIcon className="size-4" />
									{isSubmitting ? "..." : t("Create season")}
								</button>
							)}
						</form.Subscribe>
					</div>
				</form>
			</div>

			<div className="card bg-base-200 shadow-sm">
				<div className="card-body">
					<h2 className="card-title text-base">{t("Seasons")}</h2>
					<DetailsList
						columns={[
							{
								key: "title",
								label: t("Season"),
								render: (item) => item.title,
								sortable: true,
								sortFn: (left, right) =>
									left.startDate.getTime() - right.startDate.getTime(),
							},
							{
								key: "range",
								label: t("Season range"),
								render: (item) =>
									`${formatDate(item.startDate)} - ${formatDate(item.endDate)}`,
							},
							{
								key: "counts",
								label: t("Player counts by age group"),
								minWidth: "320",
								render: (item) => formatAgeGroupCounts(item),
							},
						]}
						emptyMessage={t("No seasons found")}
						getItemId={(item) => item.id}
						items={seasons}
						selectMode="single"
						commandBarItems={[
							{
								icon: <Trash2Icon className="size-4" />,
								isDisabled: (items) => items.length !== 1,
								key: "delete",
								label: t("Delete"),
								onClick: (items) => onDelete(items[0].id)(),
								onlyIcon: true,
								variant: "error",
							},
						]}
					/>
				</div>
			</div>
		</div>
	);
};
