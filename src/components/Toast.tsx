import { type ToastContentProps, toast } from "react-toastify";
import { cn } from "@/lib/utils";

type ToastData = {
	status: "success" | "error";
	text: string;
};

export const Toast = ({ data }: ToastContentProps<ToastData>) => {
	return (
		<div
			className={cn(
				"w-full h-full alert alert-soft",
				data.status === "success" ? "alert-success" : "alert-error",
			)}
		>
			<span>{data.text}</span>
		</div>
	);
};

export const notify = (data: ToastData) => {
	toast(Toast, {
		closeButton: false,
		data,
		hideProgressBar: true,
		style: {
			backgroundColor: "unset",
			minHeight: "unset",
			padding: "0",
		},
	});
};
