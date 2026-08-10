import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

@Injectable()
export class StorageService {
  private client: SupabaseClient;
  private bucketName = 'proof-of-delivery';

  constructor(private config: ConfigService) {
    this.client = createClient(
      this.config.get<string>('SUPABASE_URL')!,
      this.config.get<string>('SUPABASE_ANON_KEY')!,
    );
  }

  async uploadPhoto(fileBuffer: Buffer, mimeType: string): Promise<string> {
    const extension = mimeType.split('/')[1] || 'jpg';
    const fileName = `${randomUUID()}.${extension}`;

    const { error } = await this.client.storage
      .from(this.bucketName)
      .upload(fileName, fileBuffer, { contentType: mimeType });

    if (error) {
      throw new Error(`Failed to upload photo: ${error.message}`);
    }

    const { data } = this.client.storage.from(this.bucketName).getPublicUrl(fileName);
    return data.publicUrl;
  }
}