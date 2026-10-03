export default function PageContainer({ children, className = "", width = "max-w-5xl" }) {
  return (
    <div className={`mx-auto w-full ${width} px-4 sm:px-6 ${className}`}>{children}</div>
  );
}
