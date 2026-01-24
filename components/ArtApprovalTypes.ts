
import { Timestamp } from 'firebase/firestore';

export type ArtStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'POSTED' | 'ADJUSTMENT_REQUESTED' | 'REJECTED_TOTAL';
export type SocialMediaType = 'REELS' | 'FEED' | 'STORIES' | 'BANNER' | 'OUTRO';

export interface ArtFile {
    url: string;
    name: string;
    type: string;
    size: number;
    width?: number;
    height?: number;
}

export interface ArtFeedback {
    userId: string;
    userName: string;
    text: string;
    createdAt: Timestamp;
    versionNumber?: number;
}

export interface ArtVersion {
    versionNumber: number;
    files: ArtFile[];
    caption: string;
    createdAt: Timestamp;
    createdBy: string;
    notes?: string;
}

export interface ArtApprovalItem {
    id: string;
    title: string;
    category: string;
    subcategory: string;
    type: SocialMediaType;
    caption: string;
    postingDate: Timestamp;
    files: ArtFile[];
    isCarousel: boolean;
    dimensions: string;
    status: ArtStatus;
    companyId: string;
    createdBy: string; // Document creator (Admin)
    creatorId: string; // Assigned creator (Fulano)
    approverIds: string[]; // Assigned approvers (X, Y, Z)
    createdAt: Timestamp;
    updatedAt: Timestamp;

    currentVersion: number;
    versions: ArtVersion[];

    timeline: {
        draftDue: Timestamp;
        approvalDue: Timestamp;
        finalDue: Timestamp;
    };

    feedback?: ArtFeedback[];
}
