import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AdContent, AdStatus } from '../../models/Ads';
import { ApiJSON, FilterOptions } from '../API/api-json';


@Injectable({
  providedIn: 'root',
})
export class AdService {
  private readonly resource = 'ads';

  constructor(private api: ApiJSON) {}

  /* =====================
     CREATE
     ===================== */

  createAd(ad: Partial<AdContent>): Observable<AdContent> {
    return this.api.create<AdContent>(this.resource, ad);
  }

  /* =====================
     READ
     ===================== */

  getAds(): Observable<AdContent[]> {
    return this.api.get<AdContent[]>(this.resource);
  }

  getAdById(id: string | number): Observable<AdContent> {
    return this.api.getById<AdContent>(this.resource, id);
  }

  getAdsByStatus(status: AdStatus): Observable<AdContent[]> {
    return this.api.filter<AdContent>(this.resource, { filters: { status } }).pipe(
      map((adContent) => adContent.data)
    );
  }

  filterAds(options: FilterOptions): Observable<any> {
    return this.api.filter<AdContent>(this.resource, options);
  }

  /* =====================
     UPDATE
     ===================== */

  updateAd(id: string, data: Partial<Omit<AdContent, 'id'>>): Observable<AdContent> {
    return this.api.update<AdContent>(this.resource, id, data);
  }

  updateAdStatus(id: string, status: AdStatus): Observable<AdContent> {
    return this.api.patch<AdContent>(this.resource, id, { status });
  }

  /* =====================
     DELETE
     ===================== */

  deleteAd(id: string): Observable<void> {
    return this.api.delete(this.resource, id);
  }

  /* =====================
     TRACKING
     ===================== */

  getActiveAdByPlacement(placement: string): Observable<AdContent | null> {
    return this.getAdsByStatus(AdStatus.ACTIVE).pipe(
      map((ads: AdContent[]) => {
        const now = new Date();
        const validAds = ads.filter(ad => {
          const startDate = new Date(ad.start_date);
          const endDate = new Date(ad.end_date);
          const isWithinDateRange = now >= startDate && now <= endDate;
          const matchesPlacement = placement === 'GLOBAL' || ad.type === placement;
          return isWithinDateRange && matchesPlacement;
        });
        return validAds.length > 0 ? validAds[0] : null;
      })
    );
  }

  trackImpression(adId: string): Observable<AdContent> {
    return this.updateAd(adId, { impressions_count: 1 });
  }

  trackClick(adId: string): Observable<AdContent> {
    return this.updateAd(adId, { clicks_count: 1 });
  }
}
