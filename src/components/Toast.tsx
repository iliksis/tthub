import { toast as sonnerToast } from "sonner";
import { cn } from "@/lib/utils";

type ToastProps = {
	id: string | number;
	status: "success" | "error";
	title: string;
};

export const Toast = ({ status, title, id }: ToastProps) => {
	return (
		<div
			key={id}
			className={cn(
				"alert alert-soft",
				status === "success" ? "alert-success" : "alert-error",
			)}
		>
			<span>{title}</span>
		</div>
	);
};

export const notify = (toast: Omit<ToastProps, "id">) => {
	return sonnerToast.custom((id) => <Toast id={id} {...toast} />);
};
