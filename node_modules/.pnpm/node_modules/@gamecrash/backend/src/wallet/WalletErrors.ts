export class WalletDomainError extends Error {}

export class InsufficientBalanceError extends WalletDomainError {
  constructor() {
    super("Insufficient balance");
    this.name = "InsufficientBalanceError";
  }
}
