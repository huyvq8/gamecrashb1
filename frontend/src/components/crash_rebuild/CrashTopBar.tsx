interface Props {
  balance: number;
}

export function CrashTopBar({ balance }: Props) {
  return <header className="crash-top-bar">Balance: {Math.round(balance).toLocaleString('en-US')}</header>;
}
