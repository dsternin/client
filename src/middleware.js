export function middleware(request) {
  const token = request.cookies.get('token')?.value;

  console.log("middleware");
  console.log(token);
  
}
