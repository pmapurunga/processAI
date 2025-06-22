
'use client';

import Link from 'next/link';
import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getUserDocuments, deleteDocument } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { FileText, MessageSquare, UploadCloud, AlertCircle, CheckCircle, Loader2, Inbox, MoreVertical, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import type { DocumentMetadata } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

function getStatusBadgeVariant(status: DocumentMetadata['status']) {
    switch (status) {
        case 'processed': return 'default';
        case 'processing': case 'queued': return 'secondary';
        case 'error': return 'destructive';
        default: return 'outline';
    }
}

export default function DashboardPage() {
    const { user, loading: authLoading } = useAuth();
    const [documents, setDocuments] = useState<DocumentMetadata[]>([]);
    const [loadingDocs, setLoadingDocs] = useState(true);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const { toast } = useToast();

    const fetchDocuments = useCallback(() => {
        if (user?.uid && !authLoading) {
            setLoadingDocs(true);
            getUserDocuments(user.uid)
                .then(setDocuments)
                .catch(error => {
                    console.error("DashboardPage: Failed to fetch documents:", error);
                    toast({
                        title: "Error fetching documents",
                        description: "Could not retrieve your documents. Please try again later.",
                        variant: "destructive",
                    });
                    setDocuments([]);
                })
                .finally(() => setLoadingDocs(false));
        } else if (!authLoading) {
            setDocuments([]);
            setLoadingDocs(false);
        }
    }, [user, authLoading, toast]);

    useEffect(() => {
        fetchDocuments();
    }, [fetchDocuments]);

    const handleDeleteClick = (docId: string) => {
        setDeletingId(docId);
        setShowDeleteConfirm(true);
    };

    const confirmDelete = async () => {
        if (!deletingId) return;

        try {
            const result = await deleteDocument(deletingId);
            if (result.success) {
                toast({
                    title: "Document Deleted",
                    description: "The document has been successfully deleted.",
                });
                setDocuments(prevDocs => prevDocs.filter(doc => doc.id !== deletingId));
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            toast({
                title: "Deletion Failed",
                description: error instanceof Error ? error.message : "An unexpected error occurred.",
                variant: "destructive",
            });
        } finally {
            setShowDeleteConfirm(false);
            setDeletingId(null);
        }
    };

    const renderSkeleton = () => (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
                <Card key={i}>
                    <CardHeader>
                        <Skeleton className="h-5 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                    </CardHeader>
                    <CardContent>
                        <Skeleton className="h-4 w-1/4" />
                    </CardContent>
                    <CardFooter className="flex justify-end">
                        <Skeleton className="h-10 w-24" />
                    </CardFooter>
                </Card>
            ))}
        </div>
    );

    const renderEmptyState = () => (
        <div className="text-center py-20">
            <Inbox className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No documents yet</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by uploading your first document.</p>
            <div className="mt-6">
                <Button asChild>
                    <Link href="/upload">
                        <UploadCloud className="-ml-1 mr-2 h-5 w-5" />
                        Upload Document
                    </Link>
                </Button>
            </div>
        </div>
    );
    return (
        <div className="container mx-auto p-4 md:p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">Your Documents</h1>
                <Button asChild>
                    <Link href="/upload">
                        <UploadCloud className="mr-2 h-4 w-4" /> Upload
                    </Link>
                </Button>
            </div>

            {loadingDocs ? renderSkeleton() : documents.length === 0 ? renderEmptyState() : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {documents.map(doc => (
                        <Card key={doc.id}>
                            <CardHeader>
                                <CardTitle className="truncate">{doc.name}</CardTitle>
                                <CardDescription>Uploaded on {doc.uploadedAt ? format(new Date(doc.uploadedAt), 'PPP') : 'N/A'}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Badge variant={getStatusBadgeVariant(doc.status)}>{doc.status}</Badge>
                            </CardContent>
                            <CardFooter className="flex justify-between">
                                <Button variant="outline" asChild disabled={doc.status !== 'processed'}>
                                    <Link href={doc.status === 'processed' ? `/chat/${doc.id}` : '#'}>
                                        <MessageSquare className="mr-2 h-4 w-4" /> Chat
                                    </Link>
                                </Button>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon">
                                            <MoreVertical className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem asChild>
                                            <Link href={`/summary/${doc.id}`} className={doc.status !== 'processed' ? "pointer-events-none text-muted-foreground" : ""}>
                                                <FileText className="mr-2 h-4 w-4" /> View Summary
                                            </Link>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleDeleteClick(doc.id)} className="text-red-600">
                                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            )}
             <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure you want to delete this document?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the document and all associated data from our servers.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setShowDeleteConfirm(false)}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
                            {deletingId ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
