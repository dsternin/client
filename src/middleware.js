export function middleware(request) {
  const token = request.cookies.get("token")?.value;
}
