import { useAuthContext } from "@/components/auth/auth-provider";

/**
 * Custom hook to consume the AuthContext state and functions.
 * Can be used in any client-side component of the application.
 */
export const useAuth = () => {
  return useAuthContext();
};
