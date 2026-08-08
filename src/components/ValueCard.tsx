import {
	CardContent,
	CardTitle,
	Card as ShadcnCard,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type CardProps = {
	title?: string;
	icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
	gridRows?: 1 | 2 | 3 | 4;
};
export const Card = (props: React.PropsWithChildren<CardProps>) => {
	const span = {
		1: "col-span-1",
		2: "col-span-2",
		3: "col-span-3",
		4: "col-span-4",
	};
	return (
		<ShadcnCard className={cn("py-4", span[props.gridRows || 1])}>
			<CardContent className="flex flex-col gap-2 px-4">
				{props.title && (
					<CardTitle className="text-base">
						{/* {props.icon && <props.icon className="my-1.5 size-4" />} */}
						{props.title}
					</CardTitle>
				)}
				{props.children}
			</CardContent>
		</ShadcnCard>
	);
};
