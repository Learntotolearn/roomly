import { BackupInfo, BackupData, RestoreRequest } from '@/lib/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

export const backupApi = {
  // 获取备份列表
  async getBackupList(): Promise<{ backups: BackupInfo[]; total: number }> {
    const response = await fetch(`${API_BASE}/backup/list`);
    if (!response.ok) {
      throw new Error('获取备份列表失败');
    }
    return response.json();
  },

  // 创建备份
  async createBackup(data: { format: string; description?: string }): Promise<{ message: string; backup: BackupInfo }> {
    const response = await fetch(`${API_BASE}/backup/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || '创建备份失败');
    }
    return response.json();
  },

  // 下载备份
  async downloadBackup(filename: string): Promise<Blob> {
    const response = await fetch(`${API_BASE}/backup/download/${filename}`);
    if (!response.ok) {
      throw new Error('下载备份失败');
    }
    return response.blob();
  },

  // 删除备份
  async deleteBackup(filename: string): Promise<{ message: string }> {
    const response = await fetch(`${API_BASE}/backup/${filename}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || '删除备份失败');
    }
    return response.json();
  },

  // 获取备份详情
  async getBackupDetail(filename: string): Promise<{ backup: BackupInfo; stats: any }> {
    const response = await fetch(`${API_BASE}/backup/detail/${filename}`);
    if (!response.ok) {
      throw new Error('获取备份详情失败');
    }
    return response.json();
  },

  // 还原数据
  async restoreData(data: RestoreRequest): Promise<{ message: string; pre_backup_filename?: string }> {
    const response = await fetch(`${API_BASE}/backup/restore`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || '数据还原失败');
    }
    return response.json();
  },

  // 获取还原预览
  async getRestorePreview(filename: string): Promise<{
    filename: string;
    format: string;
    backup_data: any;
    current_data: any;
    will_replace: boolean;
  }> {
    const response = await fetch(`${API_BASE}/backup/restore/preview/${filename}`);
    if (!response.ok) {
      throw new Error('获取还原预览失败');
    }
    return response.json();
  },


};