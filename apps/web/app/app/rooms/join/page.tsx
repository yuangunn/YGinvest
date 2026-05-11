import { Card, CardContent } from "@/components/ui/card";
import { RoomJoinForm } from "@/components/room-join-form";

export default function JoinRoomPage() {
  return (
    <div className="max-w-md mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">방 가입</h1>
      <Card>
        <CardContent className="pt-6">
          <RoomJoinForm />
        </CardContent>
      </Card>
    </div>
  );
}
