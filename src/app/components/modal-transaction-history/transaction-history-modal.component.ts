import { Component, OnInit, Input } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { Transaction } from '../../../models/Wallet';
import { IonicModule } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { WalletService } from 'src/services/WALLET_SERVICE/wallet-service';

@Component({
  selector: 'app-transaction-history-modal',
  templateUrl: './transaction-history-modal.component.html',
  styleUrls: ['./transaction-history-modal.component.scss'],
  standalone: true,
  imports: [IonicModule, FormsModule, CommonModule]
})
export class TransactionHistoryModalComponent implements OnInit {
  @Input() transactions: Transaction[] = [];
  @Input() walletId: string = '';
  
  filteredTransactions: Transaction[] = [];
  selectedFilter: 'all' | 'purchase' | 'usage' | 'refund' = 'all';
  selectedItemType: 'all' | 'coins' | 'coupons' | 'gift' = 'all';
  
  constructor(private modalController: ModalController, private walletService: WalletService) {}

  ngOnInit() {
    this.loadTransactions();
  }
  
  loadTransactions() {
    this.transactions = this.walletService.getTransactions();
    this.filterTransactions();
  }
  
  dismiss() {
    this.modalController.dismiss();
  }
  
  filterTransactions() {
    this.filteredTransactions = this.transactions.filter(transaction => {
      const typeMatch = this.selectedFilter === 'all' || transaction.type === this.selectedFilter;
      const itemTypeMatch = this.selectedItemType === 'all' || transaction.itemType === this.selectedItemType;
      return typeMatch && itemTypeMatch;
    });
  }
  
  onFilterChange() {
    this.filterTransactions();
  }
  
  getTransactionIcon(type: string): string {
    switch (type) {
      case 'purchase': return 'add-circle';
      case 'usage': return 'remove-circle';
      case 'refund': return 'refresh-circle';
      default: return 'receipt';
    }
  }
  
  getTransactionColor(type: string): string {
    switch (type) {
      case 'purchase': return 'success';
      case 'usage': return 'danger';
      case 'refund': return 'warning';
      default: return 'medium';
    }
  }
  
  getItemTypeIcon(itemType: string): string {
    switch (itemType) {
      case 'coins': return 'diamond';
      case 'coupons': return 'ticket';
      case 'gift': return 'gift';
      default: return 'help-circle';
    }
  }
  
  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
  
  getTotalAmount(): number {
    return this.filteredTransactions.reduce((total, transaction) => {
      if (transaction.type === 'purchase') {
        return total + transaction.amount;
      } else if (transaction.type === 'usage') {
        return total - transaction.amount;
      }
      return total;
    }, 0);
  }
}
