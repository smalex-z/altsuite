export const useRouter = () => ({ push: jest.fn(), replace: jest.fn(), refresh: jest.fn() });
export const usePathname = () => '/';
export const useSearchParams = () => ({ get: () => null });
export const redirect = jest.fn();

export default {
  useRouter,
  usePathname,
  useSearchParams,
  redirect,
};
