import { render,screen } from '@testing-library/react';
import { auth } from '@/auth';
import { requireAnyRole } from '@/lib/guards';
import { prisma } from '@/lib/prisma';
import ParentInvoicesPage from '@/app/dashboard/parent/factures/page';
import ParentResourcesPage from '@/app/dashboard/parent/ressources/page';
import AdminDocumentsPage from '@/app/dashboard/admin/documents/page';
jest.mock('@/auth',()=>({auth:jest.fn()}));
jest.mock('@/lib/guards',()=>({requireAnyRole:jest.fn(),isErrorResponse:()=>false}));
jest.mock('@/components/admin/DocumentUploadForm',()=>({DocumentUploadForm:()=> <div>UPLOAD_FORM</div>}));
jest.mock('next/navigation',()=>({redirect:()=>{throw Error('redirect');}}));
beforeEach(()=>{jest.clearAllMocks();(auth as jest.Mock).mockResolvedValue({user:{id:'core-parent',role:'PARENT',authority:'CORE_V2'}});(requireAnyRole as jest.Mock).mockResolvedValue({user:{id:'core-admin',role:'ADMIN',authority:'CORE_V2'}});(prisma.userDocument.findMany as jest.Mock).mockResolvedValue([]);(prisma.invoice.findMany as jest.Mock).mockResolvedValue([]);});
test.each([['factures',ParentInvoicesPage],['ressources',ParentResourcesPage],['documents admin',AdminDocumentsPage]] as const)('Core direct page %s is explicitly unavailable without querying V1 data',async (_name,Page)=>{
 render(await Page());expect(screen.getByText(/pas encore disponible pour votre espace/)).toBeInTheDocument();expect(screen.queryByText('UPLOAD_FORM')).not.toBeInTheDocument();expect(prisma.invoice.findMany).not.toHaveBeenCalled();expect(prisma.userDocument.findMany).not.toHaveBeenCalled();
});
