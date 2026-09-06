jest.mock('@/lib/auth/parent-phone', () => ({ issueParentPhoneChallenge: jest.fn() }));
jest.mock('@/lib/whatsapp/invitation-outbox', () => ({ enqueueParentWhatsAppInvitation: jest.fn() }));
import { inviteParentToComplete } from '@/lib/families/create-family';
import { issueParentPhoneChallenge } from '@/lib/auth/parent-phone';
import { enqueueParentWhatsAppInvitation } from '@/lib/whatsapp/invitation-outbox';
const oldMode=process.env.WHATSAPP_SEND_ENABLED;
beforeEach(()=>{jest.clearAllMocks();delete process.env.WHATSAPP_SEND_ENABLED;});
afterAll(()=>{if(oldMode===undefined)delete process.env.WHATSAPP_SEND_ENABLED;else process.env.WHATSAPP_SEND_ENABLED=oldMode;});
it('reserves challenge without encrypted transport or raw result in manual mode',async()=>{
 const tx={user:{findUnique:jest.fn().mockResolvedValue({activatedAt:null})}};
 (issueParentPhoneChallenge as jest.Mock).mockResolvedValue({rawToken:'synthetic-raw',phoneNormalized:'99123456'});
 const result=await inviteParentToComplete(tx as never,'parent-id',new Date());
 expect(result).toEqual({queued:false,required:true});expect(issueParentPhoneChallenge).toHaveBeenCalledTimes(1);expect(enqueueParentWhatsAppInvitation).not.toHaveBeenCalled();expect(JSON.stringify(result)).not.toContain('synthetic-raw');
});
it('keeps active accounts intact and explicitly says no invitation required',async()=>{
 const tx={user:{findUnique:jest.fn().mockResolvedValue({activatedAt:new Date()})}};
 expect(await inviteParentToComplete(tx as never,'parent-id',new Date())).toEqual({queued:false,required:false});expect(issueParentPhoneChallenge).not.toHaveBeenCalled();
});
it('queues encrypted transport only with explicit automatic mode',async()=>{
 process.env.WHATSAPP_SEND_ENABLED='true';const tx={user:{findUnique:jest.fn().mockResolvedValue({activatedAt:null})}};
 (issueParentPhoneChallenge as jest.Mock).mockResolvedValue({rawToken:'synthetic-raw'});
 expect(await inviteParentToComplete(tx as never,'parent-id',new Date())).toEqual({queued:true,required:true});expect(enqueueParentWhatsAppInvitation).toHaveBeenCalledTimes(1);
});
