import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useMutation } from "@/hooks/useMutation";
import { loginFn } from "@/routes/_authed";

const formSchema = z.object({
	userName: z.string().min(1),
	password: z.string().min(1),
});

export function Login() {
	const router = useRouter();

	const loginMutation = useMutation({
		fn: loginFn,
		onSuccess: async (ctx) => {
			if (!ctx.data?.error) {
				await router.invalidate();
				return;
			}
		},
	});

	const { handleSubmit, register } = useForm<z.infer<typeof formSchema>>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			userName: "",
			password: "",
		},
	});

	const onSubmit = async (values: z.infer<typeof formSchema>) => {
		loginMutation.mutate({
			data: {
				userName: values.userName,
				password: values.password,
			},
		});
		// const response = await login(values, searchParams.get("redirect"));
		// if (response) {
		// 	setError(response);
		// }
	};

	return (
		<div className="w-dvw h-dvh relative">
			<form
				className="card w-full max-w-sm bg-base-300 shrink-0 shadow-2xl absolute top-1/2 left-1/2 -translate-y-1/2 -translate-x-1/2"
				onSubmit={handleSubmit(onSubmit)}
			>
				<div className="card-body">
					<fieldset className="fieldset">
						{/* register your input into the hook by invoking the "register" function */}
						<label className="label" htmlFor="userName">
							User Name
						</label>
						<input
							id="userName"
							className="input input-primary w-full"
							placeholder="User Name"
							{...register("userName", { required: true })}
						/>

						{/* include validation with required or other standard HTML validation rules */}
						<label className="label" htmlFor="password">
							Password
						</label>
						<input
							id="password"
							className="input input-primary w-full"
							type="password"
							placeholder="Password"
							{...register("password", { required: true })}
						/>

						<button className="btn btn-primary mt-4" type="submit">
							Login
						</button>
					</fieldset>
				</div>
			</form>
		</div>
	);
}
