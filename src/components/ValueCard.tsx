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
		<div className={`card bg-base-200 ${span[props.gridRows || 1]}`}>
			<div className="card-body p-4">
				{props.title && (
					<h2 className="card-title text-base">
						{/* {props.icon && <props.icon className="my-1.5 size-4" />} */}
						{props.title}
					</h2>
				)}
				{props.children}
			</div>
		</div>
	);
};
