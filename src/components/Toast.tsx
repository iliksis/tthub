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
		data,
		closeButton: false,
		style: {
			padding: "0",
			backgroundColor: "unset",
			minHeight: "unset",
		},
		hideProgressBar: true,
	});
};
