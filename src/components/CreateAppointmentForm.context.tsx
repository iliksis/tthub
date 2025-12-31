import React from "react";

export type AppointmentType = "holiday" | "tournament";
export type TournamentType = "bavaria" | "germany";

export type CreateAppointmentState = {
	type?: AppointmentType;
	tournamentType?: TournamentType;
};

type CreateAppointmentActions =
	| { type: "SET_TYPE"; payload: AppointmentType }
	| { type: "SET_TOURNAMENT_TYPE"; payload: TournamentType };

export const createAppointmentReducer = (
	state: CreateAppointmentState,
	action: CreateAppointmentActions,
) => {
	switch (action.type) {
		case "SET_TYPE":
			return {
				...state,
				type: action.payload,
			};
		case "SET_TOURNAMENT_TYPE":
			return {
				...state,
				tournamentType: action.payload,
			};
		default:
			console.error("Unhandled action type", action);
			return state;
	}
};

export const CreateAppointmentContext = React.createContext<
	| {
			state: CreateAppointmentState;
			dispatch: React.Dispatch<CreateAppointmentActions>;
	  }
	| undefined
>(undefined);

export const CreateAppointmentProvider = ({
	children,
}: {
	children: React.ReactNode;
}) => {
	const [state, dispatch] = React.useReducer(createAppointmentReducer, {
		tournamentType: undefined,
		type: undefined,
	});

	return (
		<CreateAppointmentContext.Provider value={{ dispatch, state }}>
			{children}
		</CreateAppointmentContext.Provider>
	);
};

export const useCreateAppointmentContext = () => {
	const context = React.useContext(CreateAppointmentContext);
	if (context === undefined) {
		throw new Error(
			"useCreateAppointmentContext must be used within a CreateAppointmentProvider",
		);
	}
	return context;
};
