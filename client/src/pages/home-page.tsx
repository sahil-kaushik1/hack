import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { web3Client } from "@/lib/web3-client";
import { useForm } from "react-hook-form";
import { Loader2, Plus, RefreshCw, LogOut, ImageIcon } from "lucide-react";

type Will = {
  tokenId: number;
  beneficiary: string;
  assetType: number;
  assetInfo: {
    assetAddress: string;
    amountOrId: string;
    metadata: string;
  };
  active: boolean;
  imageUrl?: string;
};

type MintFormData = {
  beneficiary: string;
  assetAddress: string;
  amountOrId: string;
  metadata: string;
  imageUrl: string;
};

const DEFAULT_NFT_IMAGE = "https://placehold.co/400x400/2563eb/ffffff?text=NFT";

export default function HomePage() {
  const { logoutMutation } = useAuth();
  const { toast } = useToast();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [wills, setWills] = useState<Will[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const form = useForm<MintFormData>();

  const connectWallet = async () => {
    if (isConnecting) return;

    setIsConnecting(true);
    try {
      await web3Client.connect();
      setIsConnected(true);
      toast({
        title: "Wallet Connected",
        description: "Successfully connected to your wallet",
      });
      await loadWills();
    } catch (error) {
      toast({
        title: "Connection Failed",
        description: error instanceof Error ? error.message : "Failed to connect wallet",
        variant: "destructive",
      });
      setIsConnected(false);
    } finally {
      setIsConnecting(false);
    }
  };

  const loadWills = async () => {
    if (!web3Client.isConnected()) return;

    setIsLoading(true);
    try {
      const userWills = await web3Client.getWillsForUser();
      setWills(userWills);
    } catch (error) {
      toast({
        title: "Failed to Load Wills",
        description: error instanceof Error ? error.message : "Could not load wills",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = async (data: MintFormData) => {
    if (!web3Client.isConnected()) {
      toast({
        title: "Not Connected",
        description: "Please connect your wallet first",
        variant: "destructive",
      });
      return;
    }

    try {
      await web3Client.mintNFT(
        data.beneficiary,
        1, // Default asset type
        data.assetAddress,
        data.amountOrId,
        data.metadata,
        data.imageUrl
      );
      toast({
        title: "Will Created",
        description: "Successfully created new digital will",
      });
      await loadWills();
    } catch (error) {
      toast({
        title: "Creation Failed",
        description: error instanceof Error ? error.message : "Failed to create will",
        variant: "destructive",
      });
    }
  };

  const checkIn = async (tokenId: number) => {
    if (!web3Client.isConnected()) {
      toast({
        title: "Not Connected",
        description: "Please connect your wallet first",
        variant: "destructive",
      });
      return;
    }

    try {
      await web3Client.checkIn(tokenId);
      toast({
        title: "Checked In",
        description: "Successfully checked in for will #" + tokenId,
      });
      await loadWills();
    } catch (error) {
      toast({
        title: "Check-in Failed",
        description: error instanceof Error ? error.message : "Failed to check in",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    const checkConnection = async () => {
      const connected = web3Client.isConnected();
      setIsConnected(connected);
      if (connected) {
        await loadWills();
      }
    };
    checkConnection();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">Digital Will Manager</h1>
          <div className="flex gap-4">
            {!isConnected ? (
              <Button onClick={connectWallet} disabled={isConnecting}>
                {isConnecting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  "Connect Wallet"
                )}
              </Button>
            ) : (
              <Button onClick={() => loadWills()} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            )}
            <Button variant="ghost" onClick={() => logoutMutation.mutate()}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {isConnected ? (
          <>
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-xl font-semibold">Your Digital Wills</h2>
              <Dialog>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Create New Will
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Digital Will</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="beneficiary">Beneficiary Address</Label>
                      <Input id="beneficiary" {...form.register("beneficiary")} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="assetAddress">Asset Address</Label>
                      <Input id="assetAddress" {...form.register("assetAddress")} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="amountOrId">Amount or Token ID</Label>
                      <Input id="amountOrId" {...form.register("amountOrId")} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="imageUrl">NFT Image URL</Label>
                      <Input 
                        id="imageUrl" 
                        {...form.register("imageUrl")} 
                        placeholder="Enter image URL or leave empty for default" 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="metadata">Metadata</Label>
                      <Input id="metadata" {...form.register("metadata")} />
                    </div>
                    <Button type="submit" className="w-full">Create Will</Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {wills.map((will) => (
                  <Card key={will.tokenId}>
                    <CardHeader>
                      <CardTitle>Will #{will.tokenId}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="aspect-square relative rounded-lg overflow-hidden bg-muted">
                          <img
                            src={will.imageUrl || DEFAULT_NFT_IMAGE}
                            alt={`NFT Will #${will.tokenId}`}
                            className="object-cover w-full h-full"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.src = DEFAULT_NFT_IMAGE;
                            }}
                          />
                        </div>
                        <div className="space-y-2">
                          <p><span className="font-semibold">Beneficiary:</span> {will.beneficiary}</p>
                          <p><span className="font-semibold">Asset Address:</span> {will.assetInfo.assetAddress}</p>
                          <p><span className="font-semibold">Amount/ID:</span> {will.assetInfo.amountOrId}</p>
                          <p><span className="font-semibold">Status:</span> {will.active ? "Active" : "Inactive"}</p>
                          <Button
                            onClick={() => checkIn(will.tokenId)}
                            className="w-full mt-4"
                            variant="outline"
                          >
                            Check In
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        ) : (
          <Card className="max-w-lg mx-auto mt-12">
            <CardContent className="pt-6 text-center">
              <p className="text-lg mb-4">Connect your wallet to manage your digital wills</p>
              <Button onClick={connectWallet} disabled={isConnecting}>
                {isConnecting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  "Connect Wallet"
                )}
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}