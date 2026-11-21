export default function ErrorText({ message }) {
    return message ? (
        <p className="mt-1 text-xs text-red-600">{message}</p>
    ) : null;
}
