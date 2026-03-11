import '@testing-library/jest-dom';

// Provide a global mock for next/navigation used by client components in tests
jest.mock('next/navigation', () => ({
	useRouter: () => ({ push: jest.fn(), replace: jest.fn(), refresh: jest.fn() }),
	usePathname: () => '/',
	useSearchParams: () => ({ get: () => null }),
	redirect: jest.fn(),
}));
